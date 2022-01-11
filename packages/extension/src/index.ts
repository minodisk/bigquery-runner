// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { format as formatBytes } from "bytes";
import { createWriteStream, WriteStream } from "fs";
import { readFile } from "fs/promises";
import mkdirp from "mkdirp";
import { basename, extname, isAbsolute, join } from "path";
import {
  commands,
  Diagnostic,
  DiagnosticCollection,
  ExtensionContext,
  languages,
  OutputChannel as OrigOutputChannel,
  Position,
  Range,
  TextDocument,
  Uri,
  ViewColumn,
  WebviewPanel,
  window,
  workspace,
} from "vscode";
import { BigQuery, Job } from "@google-cloud/bigquery";
import { Config } from "./config";
import {
  Accessor,
  Cell,
  createCSVFormatter,
  createFlatten,
  createJSONFormatter,
  createJSONLinesFormatter,
  createMarkdownFormatter,
  createTableFormatter,
  Formatter,
  getJobInfo,
  getTableInfo,
  Row,
} from "core";

type OutputChannel = Pick<
  OrigOutputChannel,
  "append" | "appendLine" | "show" | "dispose"
>;

type ResultChannel = {
  set(result: Result): void;
  get(): Result;
};

export type Result = {
  readonly jobId?: string;
};

class ErrorWithId {
  constructor(public error: unknown, public id: string) {}
}

export type Dependencies = {
  readonly outputChannel: OutputChannel;
  readonly resultChannel: ResultChannel;
  readonly diagnosticCollection: DiagnosticCollection;
};

export async function activate(
  ctx: ExtensionContext,
  dependencies?: Dependencies
) {
  try {
    const title = "BigQuery Runner";
    const section = "bigqueryRunner";

    const outputChannel =
      dependencies?.outputChannel ?? window.createOutputChannel(title);
    ctx.subscriptions.push(outputChannel);

    const resultChannel = dependencies?.resultChannel ?? {
      get(): Result {
        return {};
      },
      set() {
        // do nothing
      },
    };

    const diagnosticCollection =
      dependencies?.diagnosticCollection ??
      languages.createDiagnosticCollection(section);
    ctx.subscriptions.push(diagnosticCollection);

    const configManager = createConfigManager(section);
    ctx.subscriptions.push(configManager);

    // Register all available commands and their actions.
    // CommandMap describes a map of extension commands (defined in package.json)
    // and the function they invoke.
    new Map<string, () => void>([
      [
        `${section}.run`,
        wrapCallback({
          configManager,
          diagnosticCollection,
          outputChannel,
          resultChannel,
          ctx,
          callback: run,
        }),
      ],
      [
        `${section}.dryRun`,
        wrapCallback({
          configManager,
          diagnosticCollection,
          outputChannel,
          resultChannel,
          ctx,
          callback: dryRun,
        }),
      ],
    ]).forEach((action, name) => {
      ctx.subscriptions.push(commands.registerCommand(name, action));
    });

    workspace.textDocuments.forEach((document) =>
      validateQuery({
        config: configManager.get(),
        diagnosticCollection,
        outputChannel: outputChannel,
        document,
      })
    );
    ctx.subscriptions.push(
      workspace.onDidOpenTextDocument((document) =>
        validateQuery({
          config: configManager.get(),
          diagnosticCollection,
          outputChannel: outputChannel,
          document,
        })
      ),
      workspace.onDidChangeTextDocument(({ document }) =>
        validateQuery({
          config: configManager.get(),
          diagnosticCollection,
          outputChannel: outputChannel,
          document,
        })
      ),
      workspace.onDidSaveTextDocument((document) =>
        validateQuery({
          config: configManager.get(),
          diagnosticCollection,
          outputChannel: outputChannel,
          document,
        })
      ),
      // Listen for configuration changes and trigger an update, so that users don't
      // have to reload the VS Code environment after a config update.
      workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration(section)) {
          return;
        }
        configManager.refresh();
      })
    );
  } catch (err) {
    window.showErrorMessage(`${err}`);
  }
}

export function deactivate() {
  // do nothing
}

function createConfigManager(section: string) {
  let config = getConfigration(section);
  return {
    get(): Config {
      return config;
    },
    refresh(): void {
      config = getConfigration(section);
    },
    dispose(): void {
      // do nothing
    },
  };
}
type ConfigManager = ReturnType<typeof createConfigManager>;

function getConfigration(section: string): Config {
  const config = workspace.getConfiguration(section) as Config;
  return {
    ...config,
    keyFilename:
      isAbsolute(config.keyFilename) ||
      !workspace.workspaceFolders ||
      !workspace.workspaceFolders[0] ||
      workspace.workspaceFolders.length === 0
        ? config.keyFilename
        : join(workspace.workspaceFolders[0].uri.fsPath, config.keyFilename),
  };
}

const pathTimeoutId = new Map<string, NodeJS.Timeout>();

async function validateQuery({
  config,
  diagnosticCollection,
  outputChannel,
  document,
}: {
  readonly config: Config;
  readonly diagnosticCollection: DiagnosticCollection;
  readonly outputChannel: OutputChannel;
  readonly document: TextDocument;
}): Promise<void> {
  const timeoutId = pathTimeoutId.get(document.uri.path);
  if (timeoutId) {
    clearTimeout(timeoutId);
    pathTimeoutId.delete(document.uri.path);
  }
  pathTimeoutId.set(
    document.uri.path,
    setTimeout(
      () =>
        _validateQuery({
          config,
          diagnosticCollection,
          outputChannel,
          document,
        }),
      config.queryValidation.debounceInterval
    )
  );
}

async function _validateQuery({
  config,
  diagnosticCollection,
  outputChannel,
  document,
}: {
  readonly config: Config;
  readonly diagnosticCollection: DiagnosticCollection;
  readonly outputChannel: OutputChannel;
  readonly document: TextDocument;
}): Promise<void> {
  try {
    if (!config.queryValidation.enabled) {
      return;
    }
    if (!isBigQuery({ config, document })) {
      return;
    }
    outputChannel.appendLine(`Validate`);
    await dryRun({
      config,
      errorMarker: createErrorMarker({ diagnosticCollection, document }),
      outputChannel: {
        ...outputChannel,
        show(): void {
          // do nothing
        },
      },
      document,
    });
  } catch (err) {
    if (err instanceof ErrorWithId) {
      outputChannel.appendLine(`${err.error} (${err.id})`);
    } else {
      outputChannel.appendLine(`${err}`);
    }
  }
}

function isBigQuery({
  config,
  document,
}: {
  readonly config: Config;
  readonly document: TextDocument;
}): boolean {
  return (
    config.queryValidation.languageIds.includes(document.languageId) ||
    config.queryValidation.extensions.includes(extname(document.fileName))
  );
}

function wrapCallback({
  configManager,
  diagnosticCollection,
  outputChannel,
  resultChannel,
  ctx,
  callback,
}: {
  readonly configManager: ConfigManager;
  readonly diagnosticCollection: DiagnosticCollection;
  readonly outputChannel: OutputChannel;
  readonly resultChannel: ResultChannel;
  readonly ctx: ExtensionContext;
  readonly callback: (params: {
    readonly config: Config;
    readonly errorMarker: ErrorMarker;
    readonly outputChannel: OutputChannel;
    readonly document: TextDocument;
    readonly range?: Range;
    readonly ctx: ExtensionContext;
  }) => Promise<Result>;
}): () => Promise<void> {
  return async () => {
    try {
      if (!window.activeTextEditor) {
        throw new Error("no active text editor");
      }
      const { document, selection } = window.activeTextEditor;
      const config = configManager.get();
      const result = await callback({
        config,
        errorMarker: createErrorMarker({ diagnosticCollection, document }),
        outputChannel,
        document,
        range: selection,
        ctx,
      });
      resultChannel.set(result);
    } catch (err) {
      outputChannel.show(true);
      if (err instanceof ErrorWithId) {
        outputChannel.appendLine(`${err.error} (${err.id})`);
      } else {
        outputChannel.appendLine(`${err}`);
      }
    }
  };
}

async function run({
  config,
  errorMarker,
  outputChannel,
  document,
  range,
  ctx,
}: {
  readonly config: Config;
  readonly errorMarker: ErrorMarker;
  readonly outputChannel: OutputChannel;
  readonly document: TextDocument;
  readonly range?: Range;
  readonly ctx: ExtensionContext;
}): Promise<Result> {
  // outputChannel.show(true);
  outputChannel.appendLine(`Run`);

  let job!: Job;
  try {
    errorMarker.clear();
    job = await createJob({
      config,
      queryText: getQueryText({ document, range }),
    });
    outputChannel.appendLine(`Job ID: ${job.id}`);
    errorMarker.clear();
  } catch (err) {
    errorMarker.mark(err);
  }

  try {
    const [rows] = await job.getQueryResults({
      autoPaginate: true,
    });
    outputChannel.appendLine(`Results: ${rows.length} rows`);

    const jobInfo = await getJobInfo({ job });
    // outputChannel.appendLine("JOB INFO -------------------");
    // outputChannel.appendLine(JSON.stringify(jobInfo, null, 2));

    const {
      statistics: {
        query: { totalBytesBilled, cacheHit },
      },
    } = jobInfo;
    outputChannel.appendLine(
      `Result: ${formatBytes(
        parseInt(totalBytesBilled, 10)
      )} to be billed (cache: ${cacheHit})`
    );

    const tableInfo = await getTableInfo({
      keyFilename: config.keyFilename,
      tableReference: jobInfo.configuration.query.destinationTable,
    });
    // outputChannel.appendLine("TABLE INFO -------------------");
    // outputChannel.appendLine(JSON.stringify(tableInfo, null, 2));

    const {
      schema: { fields },
    } = tableInfo;
    if (!fields) {
      throw new Error(`no fields`);
    }

    const { heads, toRows } = createFlatten(fields);
    const rs = toRows(rows);
    const output = await createOutput({
      config,
      outputChannel,
      filename: document.fileName,
      ctx,
    });

    await output.open();
    await output.writeHeads({ heads });
    await output.writeRows({ heads, rows: rs });
    await output.close();

    return { jobId: job.id };
  } catch (err) {
    if (job.id) {
      throw new ErrorWithId(err, job.id);
    } else {
      throw err;
    }
  }
}

async function dryRun({
  config,
  errorMarker,
  outputChannel,
  document,
  range,
}: {
  readonly config: Config;
  readonly errorMarker: ErrorMarker;
  readonly outputChannel: OutputChannel;
  readonly document: TextDocument;
  readonly range?: Range;
}): Promise<Result> {
  // outputChannel.show(true);
  outputChannel.appendLine(`Dry run`);

  let job!: Job;
  try {
    errorMarker.clear();
    job = await createJob({
      config,
      queryText: getQueryText({ document, range }),
      dryRun: true,
    });
    errorMarker.clear();
  } catch (err) {
    errorMarker.mark(err);
  }

  outputChannel.appendLine(`Job ID: ${job.id}`);

  const { totalBytesProcessed } = job.metadata.statistics;
  const bytes =
    typeof totalBytesProcessed === "number"
      ? totalBytesProcessed
      : typeof totalBytesProcessed === "string"
      ? parseInt(totalBytesProcessed, 10)
      : undefined;
  if (bytes === undefined) {
    return {};
  }
  outputChannel.appendLine(
    `Result: ${formatBytes(bytes)} estimated to be read`
  );

  return { jobId: job.id };
}

function getQueryText({
  document,
  range,
}: {
  readonly document: TextDocument;
  readonly range?: Range;
}): string {
  const text = range?.isEmpty ? document.getText() : document.getText(range);

  if (text.trim() === "") {
    throw new Error("text is empty");
  }

  return text;
}

async function createJob({
  config,
  queryText,
  dryRun,
}: {
  readonly config: Config;
  readonly queryText: string;
  readonly dryRun?: boolean;
}): Promise<Job> {
  const client = new BigQuery({
    keyFilename: config.keyFilename,
    projectId: config.projectId,
  });
  const data = await client.createQueryJob({
    query: queryText,
    location: config.location,
    maximumBytesBilled: config.maximumBytesBilled,
    useLegacySql: config.useLegacySql,
    dryRun,
  });
  const job = data[0];
  if (!job.id) {
    throw new Error(`no job ID`);
  }
  return job;
}

function createErrorMarker({
  diagnosticCollection,
  document,
}: {
  readonly diagnosticCollection: DiagnosticCollection;
  readonly document: TextDocument;
}) {
  return {
    clear() {
      diagnosticCollection.delete(document.uri);
    },
    mark(err: unknown) {
      if (!(err instanceof Error)) {
        const first = document.lineAt(0);
        const last = document.lineAt(document.lineCount - 1);
        diagnosticCollection.set(document.uri, [
          new Diagnostic(
            new Range(first.range.start, last.range.end),
            `${err}`
          ),
        ]);
        throw err;
      }
      const { message } = err;
      const rMessage = /^(.*?) at \[(\d+):(\d+)\]$/;
      const res = rMessage.exec(message);
      if (!res) {
        const first = document.lineAt(0);
        const last = document.lineAt(document.lineCount - 1);
        diagnosticCollection.set(document.uri, [
          new Diagnostic(
            new Range(first.range.start, last.range.end),
            `${err}`
          ),
        ]);
        throw err;
      }
      const [_, m, l, c] = res;
      const line = Number(l) - 1;
      const character = Number(c) - 1;
      const range = document.getWordRangeAtPosition(
        new Position(line, character)
      );
      diagnosticCollection.set(document.uri, [
        new Diagnostic(
          range ??
            new Range(
              new Position(line, character),
              new Position(line, character + 1)
            ),
          m ?? ""
        ),
      ]);
      throw err;
    },
  };
}
type ErrorMarker = ReturnType<typeof createErrorMarker>;

type Output = {
  readonly open: () => Promise<unknown>;
  readonly path?: () => string;
  readonly writeHeads: (props: { heads: Array<Accessor> }) => Promise<unknown>;
  readonly writeRows: (props: {
    heads: Array<Accessor>;
    rows: Array<Row>;
  }) => Promise<unknown>;
  readonly close: () => Promise<void>;
};
type CreateOutputParams = {
  readonly config: Config;
  readonly outputChannel: OutputChannel;
  readonly filename: string;
  readonly ctx: ExtensionContext;
};
async function createOutput(params: CreateOutputParams): Promise<Output> {
  const { config, outputChannel, filename } = params;
  switch (config.output.type) {
    case "viewer":
      return createViewerOutput({ ctx: params.ctx });
    case "output": {
      const formatter = createFormatter({ config });
      let header: Array<string>;
      return {
        async open() {
          outputChannel.show(true);
        },
        async writeHeads({ heads }) {
          header = heads.map(({ id }) => id);
          outputChannel.append(formatter.header(header));
        },
        async writeRows({ rows }) {
          outputChannel.append(await formatter.rows({ header, rows }));
        },
        async close() {
          outputChannel.append(formatter.footer());
        },
      };
    }
    case "file": {
      const formatter = createFormatter({ config });
      let stream: WriteStream;
      let header: Array<string>;
      return {
        async open() {
          if (!workspace.workspaceFolders || !workspace.workspaceFolders[0]) {
            throw new Error(`no workspace folders`);
          }
          const dirname = join(
            workspace.workspaceFolders[0].uri.path ||
              workspace.workspaceFolders[0].uri.fsPath,
            config.output.file.path
          );
          await mkdirp(dirname);
          const path = join(
            dirname,
            `${basename(filename, extname(filename))}${formatToExtension(
              config.format.type
            )}`
          );
          outputChannel.appendLine(`Output to: ${path}`);
          stream = createWriteStream(path);
        },
        async writeHeads({ heads }) {
          header = heads.map(({ id }) => id);
          const res = formatter.header(header);
          if (res) {
            stream.write(res);
          }
        },
        async writeRows({ rows }) {
          stream.write(await formatter.rows({ header, rows }));
        },
        async close() {
          stream.write(formatter.footer());
          await new Promise((resolve, reject) => {
            stream.on("error", reject).on("finish", resolve).end();
          });
          outputChannel.appendLine(
            `Total bytes written: ${formatBytes(stream.bytesWritten)}`
          );
        },
      };
    }
  }
}

let panel: WebviewPanel | undefined;

function createViewerOutput({ ctx }: { ctx: ExtensionContext }): Output {
  return {
    async open() {
      if (!panel) {
        const root = join(ctx.extensionPath, "out/viewer");
        panel = window.createWebviewPanel(
          "bigqueryRunner",
          "BigQuery Runner",
          ViewColumn.Beside,
          {
            enableScripts: true,
            localResourceRoots: [Uri.file(root)],
          }
        );
        const base = Uri.file(root)
          .with({
            scheme: "vscode-resource",
          })
          .toString();
        const html = (
          await readFile(join(root, "index.html"), "utf-8")
        ).replace("<head>", `<head><base href="${base}/" />`);
        panel.webview.html = html;
        panel.onDidDispose(
          () => {
            panel = undefined;
          },
          null,
          ctx.subscriptions
        );
      }

      return panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "clear",
        },
      });
    },
    path() {
      return "";
    },
    async writeHeads({ heads }) {
      if (!panel) {
        throw new Error(`panel is not initialized`);
      }
      return panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "header",
          payload: heads.map(({ id }) => id),
        },
      });
    },
    async writeRows({ rows }) {
      if (!panel) {
        throw new Error(`panel is not initialized`);
      }
      return panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "rows",
          payload: rows.map((row) =>
            row.reduce<{ [accessor: string]: Cell["value"] }>((obj, cell) => {
              if (cell) {
                obj[cell.id] = cell.value;
              }
              return obj;
            }, {})
          ),
        },
      });
    },
    async close() {
      // do nothing
    },
  };
}

function createFormatter({ config }: { config: Config }): Formatter {
  switch (config.format.type) {
    case "table":
      return createTableFormatter();
    case "markdown":
      return createMarkdownFormatter();
    case "json-lines":
      return createJSONLinesFormatter();
    case "json":
      return createJSONFormatter();
    case "csv":
      return createCSVFormatter(config.format.csv);
    default:
      throw new Error(`Invalid format: ${config.format.type}`);
  }
}

function formatToExtension(format: Config["format"]["type"]) {
  return {
    table: ".txt",
    markdown: ".md",
    "json-lines": ".jsonl",
    json: ".json",
    csv: ".csv",
  }[format];
}
