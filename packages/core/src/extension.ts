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
import * as CSV from "csv-stringify";
import EasyTable from "easy-table";
import { flatten } from "flat";
import { createWriteStream } from "fs";
import { readFile } from "fs/promises";
import mkdirp from "mkdirp";
import { basename, extname, isAbsolute, join } from "path";
import { tenderize } from "tenderizer";
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
  window,
  workspace,
} from "vscode";
import { BigQuery, Job } from "@google-cloud/bigquery";
import { Config } from "./config";

type Writer = {
  readonly path?: string;
  readonly write: (chunk: string) => void;
  readonly writeLine: (chunk: string) => void;
  readonly close: () => Promise<void>;
};

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
  ctx: Pick<ExtensionContext, "subscriptions" | "extensionPath">,
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
      set() {},
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
          outputChannel: outputChannel,
          resultChannel: resultChannel,
          extensionPath: ctx.extensionPath,
          callback: run,
        }),
      ],
      [
        `${section}.dryRun`,
        wrapCallback({
          configManager,
          diagnosticCollection,
          outputChannel: outputChannel,
          resultChannel: resultChannel,
          extensionPath: ctx.extensionPath,
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

export function deactivate() {}

function createConfigManager(section: string) {
  let config = getConfigration(section);
  return {
    get(): Config {
      return config;
    },
    refresh(): void {
      config = getConfigration(section);
    },
    dispose(): void {},
  };
}
type ConfigManager = ReturnType<typeof createConfigManager>;

function getConfigration(section: string): Config {
  const config = workspace.getConfiguration(section) as any as Config;
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
    outputChannel.appendLine("");
  } catch (err) {
    if (err instanceof ErrorWithId) {
      outputChannel.appendLine(`${err.error} (${err.id})`);
    } else {
      outputChannel.appendLine(`${err}`);
    }
    outputChannel.appendLine("");
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
  extensionPath,
  callback,
}: {
  readonly configManager: ConfigManager;
  readonly diagnosticCollection: DiagnosticCollection;
  readonly outputChannel: OutputChannel;
  readonly resultChannel: ResultChannel;
  readonly extensionPath: string;
  readonly callback: (params: {
    readonly config: Config;
    readonly errorMarker: ErrorMarker;
    readonly outputChannel: OutputChannel;
    readonly document: TextDocument;
    readonly range?: Range;
    readonly extensionPath: string;
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
        extensionPath,
      });
      resultChannel.set(result);
    } catch (err) {
      outputChannel.show(true);
      if (err instanceof ErrorWithId) {
        outputChannel.appendLine(`${err.error} (${err.id})`);
      } else {
        outputChannel.appendLine(`${err}`);
      }
    } finally {
      outputChannel.appendLine("");
    }
  };
}

async function run({
  config,
  errorMarker,
  outputChannel,
  document,
  range,
  extensionPath,
}: {
  readonly config: Config;
  readonly errorMarker: ErrorMarker;
  readonly outputChannel: OutputChannel;
  readonly document: TextDocument;
  readonly range?: Range;
  readonly extensionPath: string;
}): Promise<Result> {
  outputChannel.show(true);
  outputChannel.appendLine(`Run`);

  let job!: Job;
  try {
    errorMarker.clear();
    job = await createJob({
      config,
      queryText: getQueryText({ document, range }),
    });
    errorMarker.clear();
  } catch (err) {
    errorMarker.mark(err);
  }

  try {
    const output = await createOutput({
      config,
      outputChannel,
      filename: document.fileName,
      extensionPath,
    });

    outputChannel.appendLine(`Job ID: ${job.id}`);

    const res = await job.getQueryResults({
      autoPaginate: true,
    });
    const [rows] = res;

    outputChannel.appendLine(`Result: ${rows.length} rows`);

    switch (config.format.type) {
      case "table":
        const t = new EasyTable();
        rows.forEach((row) => {
          tenderize(row).forEach((o) => {
            Object.keys(o).forEach((key) => t.cell(key, o[key]));
            t.newRow();
          });
        });
        output.writeLine(t.toString().trimEnd());
        output.close();
        break;
      case "markdown":
        const keys = new Set<string>();
        const rs = rows.flatMap((row) => {
          const ts = tenderize(row);
          ts.map((t) => {
            Object.keys(t).forEach((key) => {
              keys.add(key);
            });
          });
          return ts;
        });
        const ks = Array.from(keys);
        const m: Array<string> = [
          `|${ks.join("|")}|`,
          `|${ks.map(() => "---").join("|")}|`,
          ...rs.map(
            (r) =>
              `|${ks
                .map((key) => {
                  if (!r[key]) {
                    return "";
                  }
                  return `${r[key]}`.replace("\n", "<br/>");
                })
                .join("|")}|`
          ),
        ];
        output.writeLine(m.join("\n"));
        output.close();
        break;
      case "json-lines":
        rows.forEach((row) => {
          output.writeLine(JSON.stringify(flatten(row, { safe: true })));
        });
        output.close();
        break;
      case "json":
        output.write("[");
        rows.forEach((row, i) => {
          output.write(
            (i === 0 ? "" : ",") + JSON.stringify(flatten(row, { safe: true }))
          );
        });
        output.writeLine("]");
        output.close();
        break;
      case "csv":
        const structs = rows.flatMap((row) => tenderize(row));
        await new Promise<void>((resolve, reject) => {
          CSV.stringify(
            structs,
            config.format.csv,
            (err?: Error, res?: string) => {
              if (err) {
                reject(err);
                return;
              }
              if (res) {
                output.write(res);
                output.close();
              }
              resolve();
            }
          );
        });
        break;
      default:
        throw new Error(`Invalid format: ${config.format.type}`);
    }

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
  outputChannel.show(true);
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
    mark(err: any) {
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

async function createOutput({
  config,
  outputChannel,
  filename,
  extensionPath,
}: {
  readonly config: Config;
  readonly outputChannel: OutputChannel;
  readonly filename: string;
  readonly extensionPath: string;
}): Promise<Writer> {
  switch (config.output.type) {
    case "viewer":
      const panel = window.createWebviewPanel(
        "bigqueryRunner",
        "BigQuery Runner",
        ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [Uri.file(join(extensionPath, "build"))],
        }
      );
      const base = Uri.file(join(extensionPath, "build")).with({
        scheme: "vscode-resource",
      });
      // outputChannel.appendLine(JSON.stringify(base, null, 2));
      // outputChannel.appendLine(base.toString());
      const html = (
        await readFile(join(extensionPath, "build", "index.html"), "utf-8")
      ).replace("%BASE_URL%", base.toString());
      // outputChannel.appendLine(html);
      panel.webview.html = html;
      return {
        write(chunk: string) {
          panel.webview.postMessage(chunk);
        },
        writeLine(chunk: string) {
          panel.webview.postMessage(chunk + "\n");
        },
        async close() {},
      };
    case "output":
      return {
        write(chunk: string) {
          outputChannel.show(true);
          outputChannel.append(chunk);
        },
        writeLine(chunk: string) {
          outputChannel.show(true);
          outputChannel.appendLine(chunk);
        },
        async close() {},
      };
    case "file":
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
      const stream = createWriteStream(path);
      return {
        path,
        write: (chunk) => stream.write(chunk),
        writeLine: (chunk) => stream.write(chunk + "\n"),
        async close() {
          return new Promise((resolve, reject) => {
            outputChannel.appendLine(
              `Total bytes written: ${formatBytes(stream.bytesWritten)}`
            );
            stream.on("error", reject).on("finish", resolve).end();
          });
        },
      };
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
