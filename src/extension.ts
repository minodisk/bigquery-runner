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
import deepmerge from "deepmerge";
import { flatten } from "flat";
import { createWriteStream } from "fs";
import mkdirp from "mkdirp";
import { basename, extname, join } from "path";
import { tenderize } from "tenderizer";
import {
  commands,
  Diagnostic,
  DiagnosticCollection,
  ExtensionContext,
  languages,
  OutputChannel,
  Position,
  Range,
  TextDocument,
  window,
  workspace,
} from "vscode";
import { BigQuery, Job } from "@google-cloud/bigquery";

type Writer = {
  readonly path?: string;
  readonly write: (chunk: string) => void;
  readonly writeLine: (chunk: string) => void;
  readonly close: () => Promise<void>;
};

type Config = {
  readonly keyFilename: string;
  readonly projectId: string;
  readonly location: string;
  readonly useLegacySql: boolean;
  readonly maximumBytesBilled?: string;
  readonly verifyOnSave: {
    readonly enabled: boolean;
    readonly languageIds: Array<string>;
    readonly extensions: Array<string>;
  };
  readonly output: {
    readonly destination: {
      readonly type: OutputDestination;
      readonly file: {
        readonly path: string;
      };
    };
    readonly format: {
      readonly type: OutputFormat;
      readonly csv: {
        readonly header: boolean;
        readonly delimiter: string;
      };
      readonly json: {
        readonly space?: string;
      };
    };
  };
};

type OutputDestination = "output" | "file";

const formats = ["table", "markdown", "json-lines", "json", "csv"] as const;
type OutputFormat = typeof formats[number];

const extensions = [".txt", ".md", ".jsonl", ".json", ".csv"] as const;
type OutputExtension = typeof extensions[number];

class ErrorWithId {
  constructor(public error: unknown, public id: string) {}
}

export async function activate(ctx: ExtensionContext) {
  try {
    const title = "BigQuery Runner";
    const section = "bigqueryRunner";

    const outputChannel = window.createOutputChannel(title);
    ctx.subscriptions.push(outputChannel);

    const diagnosticCollection = languages.createDiagnosticCollection(section);
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
          callback: run,
        }),
      ],
      [
        `${section}.dryRun`,
        wrapCallback({
          configManager,
          diagnosticCollection,
          outputChannel,
          callback: dryRun,
        }),
      ],
    ]).forEach((action, name) => {
      ctx.subscriptions.push(commands.registerCommand(name, action));
    });

    ctx.subscriptions.push(
      workspace.onDidOpenTextDocument((document) =>
        verify({
          config: configManager.get(),
          diagnosticCollection,
          outputChannel,
          document,
        })
      ),
      workspace.onDidSaveTextDocument((document) =>
        verify({
          config: configManager.get(),
          diagnosticCollection,
          outputChannel,
          document,
        })
      ),
      // Listen for configuration changes and trigger an update, so that users don't
      // have to reload the VS Code environment after a config update.
      workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration(section)) {
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
  let config = workspace.getConfiguration(section) as any as Config;
  return {
    get(): Config {
      return config;
    },
    refresh(): void {
      config = deepmerge(config, workspace.getConfiguration(section));
    },
    dispose(): void {},
  };
}
type ConfigManager = ReturnType<typeof createConfigManager>;

async function verify({
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
    if (!config.verifyOnSave.enabled) {
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
    config.verifyOnSave.languageIds.includes(document.languageId) ||
    config.verifyOnSave.extensions.includes(extname(document.fileName))
  );
}

function wrapCallback({
  configManager,
  diagnosticCollection,
  outputChannel,
  callback,
}: {
  readonly configManager: ConfigManager;
  readonly diagnosticCollection: DiagnosticCollection;
  readonly outputChannel: OutputChannel;
  readonly callback: (params: {
    readonly config: Config;
    readonly errorMarker: ErrorMarker;
    readonly outputChannel: OutputChannel;
    readonly document: TextDocument;
    readonly range?: Range;
  }) => Promise<void>;
}): () => void {
  return async () => {
    try {
      if (!window.activeTextEditor) {
        throw new Error("no active text editor");
      }
      const { document, selection } = window.activeTextEditor;
      await callback({
        config: configManager.get(),
        errorMarker: createErrorMarker({ diagnosticCollection, document }),
        outputChannel,
        document,
        range: selection,
      });
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
}: {
  readonly config: Config;
  readonly errorMarker: ErrorMarker;
  readonly outputChannel: OutputChannel;
  readonly document: TextDocument;
  readonly range?: Range;
}): Promise<void> {
  outputChannel.show(true);
  outputChannel.appendLine(`Run`);

  errorMarker.clear();

  let job!: Job;
  const queryText = getQueryText({ document, range });

  try {
    job = await createJob({
      config,
      queryText,
    });
  } catch (err) {
    errorMarker.mark(err);
  }

  try {
    const output = await createOutput({
      config,
      outputChannel,
      filename: document.fileName,
    });

    outputChannel.appendLine(`Job ID: ${job.id}`);

    const res = await job.getQueryResults({
      autoPaginate: true,
    });
    const [rows] = res;

    outputChannel.appendLine(`Result: ${rows.length} rows`);

    switch (config.output.format.type) {
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
            config.output.format.csv,
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
        throw new Error(`Invalid output.format: ${config.output.format}`);
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
  document,
  range,
}: {
  readonly config: Config;
  readonly errorMarker: ErrorMarker;
  readonly outputChannel: OutputChannel;
  readonly document: TextDocument;
  readonly range?: Range;
}): Promise<void> {
  try {
    outputChannel.show(true);
    outputChannel.appendLine(`Dry run`);

    errorMarker.clear();

    const job = await createJob({
      config,
      queryText: getQueryText({ document, range }),
      dryRun: true,
    });

    outputChannel.appendLine(`Job ID: ${job.id}`);

    const { totalBytesProcessed } = job.metadata.statistics;
    const bytes =
      typeof totalBytesProcessed === "number"
        ? totalBytesProcessed
        : typeof totalBytesProcessed === "string"
        ? parseInt(totalBytesProcessed, 10)
        : undefined;
    if (bytes === undefined) {
      return;
    }
    outputChannel.appendLine(
      `Result: ${formatBytes(bytes)} estimated to be read`
    );
  } catch (err) {
    errorMarker.mark(err);
  }
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
        throw err;
      }
      const { message } = err;
      const rMessage = /^(.*?) at \[(\d+):(\d+)\]$/;
      const res = rMessage.exec(message);
      if (!res) {
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
          m
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
}: {
  readonly config: Config;
  readonly outputChannel: OutputChannel;
  readonly filename: string;
}): Promise<Writer> {
  switch (config.output.destination.type) {
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
      if (!workspace.workspaceFolders) {
        throw new Error(`no workspace folders`);
      }
      const dirname = join(
        workspace.workspaceFolders[0].uri.path ||
          workspace.workspaceFolders[0].uri.fsPath,
        config.output.destination.file.path
      );
      await mkdirp(dirname);
      const path = join(
        dirname,
        `${basename(filename, extname(filename))}${formatToExtension(
          config.output.format.type
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

function formatToExtension(format: OutputFormat): OutputExtension {
  return extensions[formats.indexOf(format)];
}
