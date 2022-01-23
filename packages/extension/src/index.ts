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
  MarkdownString,
  OutputChannel as OrigOutputChannel,
  Position,
  Range,
  StatusBarAlignment,
  StatusBarItem,
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
  Formatter,
  RunJob,
  Output,
  DryRunJob,
  AuthenticationError,
  Results,
  NoPageTokenError,
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

    const statusManager = createStatusManager({
      statusBarItem: window.createStatusBarItem(StatusBarAlignment.Right, 9999),
    });
    ctx.subscriptions.push(statusManager);

    // Register all available commands and their actions.
    // CommandMap describes a map of extension commands (defined in package.json)
    // and the function they invoke.
    new Map<string, () => void>([
      [
        `${section}.dryRun`,
        wrapCallback({
          configManager,
          diagnosticCollection,
          outputChannel,
          resultChannel,
          statusManager,
          ctx,
          callback: dryRun,
        }),
      ],
      [
        `${section}.run`,
        wrapCallback({
          configManager,
          diagnosticCollection,
          outputChannel,
          resultChannel,
          statusManager,
          ctx,
          callback: run,
        }),
      ],
      [
        `${section}.prevPage`,
        wrapCallback({
          configManager,
          diagnosticCollection,
          outputChannel,
          resultChannel,
          statusManager,
          ctx,
          callback: runPrevPage,
        }),
      ],
      [
        `${section}.nextPage`,
        wrapCallback({
          configManager,
          diagnosticCollection,
          outputChannel,
          resultChannel,
          statusManager,
          ctx,
          callback: runNextPage,
        }),
      ],
    ]).forEach((action, name) => {
      ctx.subscriptions.push(commands.registerCommand(name, action));
    });

    workspace.textDocuments.forEach((document) =>
      validateQuery({
        config: configManager.get(),
        diagnosticCollection,
        outputChannel,
        statusManager,
        document,
      })
    );
    ctx.subscriptions.push(
      window.onDidChangeActiveTextEditor((editor) => {
        if (
          !editor ||
          !isBigQuery({
            config: configManager.get(),
            document: editor.document,
          })
        ) {
          statusManager.hide();
          return;
        }

        validateQuery({
          config: configManager.get(),
          diagnosticCollection,
          outputChannel,
          statusManager,
          document: editor.document,
        });
      }),
      workspace.onDidOpenTextDocument((document) =>
        validateQuery({
          config: configManager.get(),
          diagnosticCollection,
          outputChannel,
          statusManager,
          document,
        })
      ),
      workspace.onDidChangeTextDocument(({ document }) =>
        validateQuery({
          config: configManager.get(),
          diagnosticCollection,
          outputChannel,
          statusManager,
          document,
        })
      ),
      workspace.onDidSaveTextDocument((document) =>
        validateQuery({
          config: configManager.get(),
          diagnosticCollection,
          outputChannel,
          statusManager,
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

function createStatusManager({
  statusBarItem,
}: {
  statusBarItem: StatusBarItem;
}) {
  let messages = new Map<
    string,
    { text: string; tooltip: string | MarkdownString }
  >();
  return {
    set(
      document: TextDocument,
      text: string,
      tooltip: string | MarkdownString
    ) {
      messages.set(document.fileName, { text, tooltip });
      if (document.fileName === window.activeTextEditor?.document.fileName) {
        statusBarItem.text = text;
        statusBarItem.tooltip = tooltip;
        statusBarItem.show();
      }
    },
    hide() {
      statusBarItem.hide();
      statusBarItem.text = "";
      statusBarItem.tooltip = undefined;
    },
    dispose() {
      statusBarItem.dispose();
      messages.forEach((_, key) => messages.delete(key));
      messages = undefined!;
    },
  };
}
type StatusManager = ReturnType<typeof createStatusManager>;

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
  const config = workspace.getConfiguration(section) as any as Config;
  return {
    ...config,
    pagination: {
      results:
        config.pagination?.results === undefined ||
        config.pagination?.results === null
          ? undefined
          : config.pagination.results,
    },
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
  statusManager,
  document,
}: {
  readonly config: Config;
  readonly diagnosticCollection: DiagnosticCollection;
  readonly outputChannel: OutputChannel;
  readonly statusManager: StatusManager;
  readonly document: TextDocument;
}): Promise<void> {
  if (!isBigQuery({ config, document })) {
    return;
  }

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
          statusManager,
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
  statusManager,
  document,
}: {
  readonly config: Config;
  readonly diagnosticCollection: DiagnosticCollection;
  readonly outputChannel: OutputChannel;
  readonly statusManager: StatusManager;
  readonly document: TextDocument;
}): Promise<void> {
  try {
    if (!config.queryValidation.enabled) {
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
      statusManager,
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
  statusManager,
  resultChannel,
  ctx,
  callback,
}: {
  readonly configManager: ConfigManager;
  readonly diagnosticCollection: DiagnosticCollection;
  readonly outputChannel: OutputChannel;
  readonly resultChannel: ResultChannel;
  readonly statusManager: StatusManager;
  readonly ctx: ExtensionContext;
  readonly callback: (params: {
    readonly config: Config;
    readonly errorMarker: ErrorMarker;
    readonly outputChannel: OutputChannel;
    readonly statusManager: StatusManager;
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
        statusManager,
        document,
        range: selection,
        ctx,
      });
      resultChannel.set(result);
    } catch (err) {
      if (err instanceof ErrorWithId) {
        outputChannel.appendLine(`${err.error} (${err.id})`);
      } else {
        outputChannel.appendLine(`${err}`);
      }
      if (
        err instanceof AuthenticationError ||
        err instanceof NoPageTokenError
      ) {
        window.showErrorMessage(`${err.message}`);
      }
    }
  };
}

let job: RunJob | undefined;

async function run({
  config,
  errorMarker,
  outputChannel,
  statusManager,
  document,
  range,
  ctx,
}: {
  readonly config: Config;
  readonly errorMarker: ErrorMarker;
  readonly outputChannel: OutputChannel;
  readonly statusManager: StatusManager;
  readonly document: TextDocument;
  readonly range?: Range;
  readonly ctx: ExtensionContext;
}): Promise<Result> {
  outputChannel.appendLine(`Run`);

  const output = await createOutput({
    config,
    outputChannel,
    filename: document.fileName,
    ctx,
  });
  const path = await output.open();
  if (path !== undefined) {
    outputChannel.appendLine(`Output to: ${path}`);
  }

  try {
    errorMarker.clear();

    const client = await createClient(config);
    job = await client.createRunJob({
      query: getQueryText({ document, range }),
      maxResults: config.pagination.results,
    });
    outputChannel.appendLine(`Job ID: ${job.id}`);

    errorMarker.clear();
  } catch (err) {
    output.close();
    errorMarker.mark(err);
  }

  if (!job) {
    throw new Error(`no job`);
  }

  await renderRows({
    outputChannel,
    statusManager,
    document,
    output,
    results: await job.getRows(),
  });
  return { jobId: job.id };
}

async function runPrevPage({
  config,
  outputChannel,
  statusManager,
  document,
  ctx,
}: {
  readonly config: Config;
  readonly outputChannel: OutputChannel;
  readonly statusManager: StatusManager;
  readonly document: TextDocument;
  readonly ctx: ExtensionContext;
}) {
  if (!job) {
    throw new Error(`no job`);
  }

  const output = await createOutput({
    config,
    outputChannel,
    filename: document.fileName,
    ctx,
  });
  const path = await output.open();
  if (path !== undefined) {
    outputChannel.appendLine(`Output to: ${path}`);
  }

  let results: Results;
  try {
    results = await job.getPrevRows();
  } catch (err) {
    output.close();
    throw err;
  }

  await renderRows({
    outputChannel,
    statusManager,
    document,
    output,
    results: results!,
  });

  return { jobId: job.id };
}

async function runNextPage({
  config,
  outputChannel,
  statusManager,
  document,
  ctx,
}: {
  readonly config: Config;
  readonly outputChannel: OutputChannel;
  readonly statusManager: StatusManager;
  readonly document: TextDocument;
  readonly ctx: ExtensionContext;
}) {
  if (!job) {
    throw new Error(`no job`);
  }

  const output = await createOutput({
    config,
    outputChannel,
    filename: document.fileName,
    ctx,
  });
  const path = await output.open();
  if (path !== undefined) {
    outputChannel.appendLine(`Output to: ${path}`);
  }

  let results: Results;
  try {
    results = await job.getNextRows();
  } catch (err) {
    output.close();
    throw err;
  }

  await renderRows({
    outputChannel,
    statusManager,
    document,
    output,
    results: results!,
  });

  return { jobId: job.id };
}

async function renderRows({
  outputChannel,
  statusManager,
  document,
  output,
  results,
}: {
  readonly outputChannel: OutputChannel;
  readonly statusManager: StatusManager;
  readonly document: TextDocument;
  readonly output: Output;
  readonly results: Results;
}) {
  if (!job) {
    throw new Error(`no job`);
  }

  try {
    outputChannel.appendLine(`Result: ${results.rows.length} rows`);
    const { query, schema, numRows } = await job.getInfo();
    const bytes = formatBytes(parseInt(query.totalBytesBilled, 10));
    outputChannel.appendLine(
      `Result: ${bytes} to be billed (cache: ${query.cacheHit})`
    );
    statusManager.set(
      document,
      `$(run) ${bytes}`,
      `${bytes} billed for the job (cache: ${query.cacheHit})`
    );

    const flat = createFlat(schema.fields);
    await output.writeHeads({ flat });
    await output.writeRows({ ...results, numRows, flat });
    const bytesWritten = await output.bytesWritten();
    if (bytesWritten !== undefined) {
      outputChannel.appendLine(
        `Total bytes written: ${formatBytes(bytesWritten)}`
      );
    }
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
  statusManager,
  document,
  range,
}: {
  readonly config: Config;
  readonly errorMarker: ErrorMarker;
  readonly outputChannel: OutputChannel;
  readonly statusManager: StatusManager;
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
  const bytes = formatBytes(totalBytesProcessed);
  outputChannel.appendLine(`Result: ${bytes} estimated to be read`);

  statusManager.set(
    document,
    `$(dashboard) ${bytes}`,
    `This query will process ${bytes} when run.`
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
}: {
  readonly config: Config;
  readonly outputChannel: OutputChannel;
  readonly filename: string;
  readonly ctx: ExtensionContext;
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
      });
    case "log":
      return createLogOutput({
        formatter: createFormatter({ config }),
        outputChannel,
      });
    case "file":
      if (!workspace.workspaceFolders || !workspace.workspaceFolders[0]) {
        throw new Error(`no workspace folders`);
      }
      return createFileOutput({
        formatter: createFormatter({ config }),
        dirname: join(
          workspace.workspaceFolders[0].uri.path ||
            workspace.workspaceFolders[0].uri.fsPath,
          config.output.file.path
        ),
        filename,
      });
  }
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
      return createCSVFormatter({ options: config.format.csv });
    default:
      throw new Error(`Invalid format: ${config.format.type}`);
  }
}
