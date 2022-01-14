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
import { extname, isAbsolute, join } from "path";
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
  window,
  workspace,
} from "vscode";
import { Config } from "./config";
import {
  createClient,
  createCSVFormatter,
  createFileOutput,
  createFlat,
  createJSONFormatter,
  createJSONLinesFormatter,
  createLogOutput,
  createMarkdownFormatter,
  createTableFormatter,
  createViewerOutput,
  Flat,
  Formatter,
  RunJob,
  Output,
  DryRunJob,
  AuthenticationError,
} from "core";
import { readFile } from "fs/promises";

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
      config.keyFilename === null || config.keyFilename === undefined
        ? undefined
        : isAbsolute(config.keyFilename) ||
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
      console.log(err instanceof AuthenticationError);
      if (err instanceof AuthenticationError) {
        window.showErrorMessage(`${err.message}`);
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
  outputChannel.appendLine(`Run`);

  const client = await createClient(config);

  let job!: RunJob;
  try {
    errorMarker.clear();
    job = await client.createRunJob({
      query: getQueryText({ document, range }),
    });
    outputChannel.appendLine(`Job ID: ${job.id}`);
    errorMarker.clear();
  } catch (err) {
    errorMarker.mark(err);
  }

  try {
    const rows = await job.getRows();
    outputChannel.appendLine(`Results: ${rows.length} rows`);
    const { query, schema } = await job.getInfo();
    outputChannel.appendLine(
      `Result: ${formatBytes(
        parseInt(query.totalBytesBilled, 10)
      )} to be billed (cache: ${query.cacheHit})`
    );

    const flat = createFlat(schema.fields);
    const output = await createOutput({
      config,
      outputChannel,
      filename: document.fileName,
      ctx,
      flat,
    });

    const path = await output.open();
    if (path !== undefined) {
      outputChannel.appendLine(`Output to: ${path}`);
    }
    await output.writeHeads();
    await output.writeRows(rows);
    const bytesWritten = await output.close();
    if (bytesWritten !== undefined) {
      outputChannel.appendLine(
        `Total bytes written: ${formatBytes(bytesWritten)}`
      );
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
  outputChannel.appendLine(`Dry run`);

  const client = await createClient(config);

  let job!: DryRunJob;
  try {
    errorMarker.clear();
    job = await client.createDryRunJob({
      query: getQueryText({ document, range }),
    });
    errorMarker.clear();
  } catch (err) {
    errorMarker.mark(err);
  }

  outputChannel.appendLine(`Job ID: ${job.id}`);
  const { totalBytesProcessed } = job.getInfo();
  outputChannel.appendLine(
    `Result: ${formatBytes(totalBytesProcessed)} estimated to be read`
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

async function createOutput({
  config,
  outputChannel,
  filename,
  ctx,
  flat,
}: {
  readonly config: Config;
  readonly outputChannel: OutputChannel;
  readonly filename: string;
  readonly ctx: ExtensionContext;
  readonly flat: Flat;
}): Promise<Output> {
  switch (config.output.type) {
    case "viewer":
      const root = join(ctx.extensionPath, "out/viewer");
      const base = Uri.file(root)
        .with({
          scheme: "vscode-resource",
        })
        .toString();
      const html = (await readFile(join(root, "index.html"), "utf-8")).replace(
        "<head>",
        `<head><base href="${base}/" />`
      );
      return createViewerOutput({
        html,
        subscriptions: ctx.subscriptions,
        createWebviewPanel: () => {
          const panel = window.createWebviewPanel(
            "bigqueryRunner",
            "BigQuery Runner",
            { viewColumn: -2, preserveFocus: true },
            {
              enableScripts: true,
              localResourceRoots: [Uri.file(root)],
            }
          );
          ctx.subscriptions.push(panel);
          return panel;
        },
        flat,
      });
    case "output":
      return createLogOutput({
        formatter: createFormatter({ config, flat }),
        outputChannel,
      });
    case "file":
      if (!workspace.workspaceFolders || !workspace.workspaceFolders[0]) {
        throw new Error(`no workspace folders`);
      }
      return createFileOutput({
        formatter: createFormatter({ config, flat }),
        dirname: join(
          workspace.workspaceFolders[0].uri.path ||
            workspace.workspaceFolders[0].uri.fsPath,
          config.output.file.path
        ),
        filename,
      });
  }
}

function createFormatter({
  config,
  flat,
}: {
  config: Config;
  flat: Flat;
}): Formatter {
  switch (config.format.type) {
    case "table":
      return createTableFormatter({ flat });
    case "markdown":
      return createMarkdownFormatter({ flat });
    case "json-lines":
      return createJSONLinesFormatter();
    case "json":
      return createJSONFormatter();
    case "csv":
      return createCSVFormatter({ flat, options: config.format.csv });
    default:
      throw new Error(`Invalid format: ${config.format.type}`);
  }
}
