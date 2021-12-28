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
import deepmerge from "deepmerge";
import EasyTable from "easy-table";
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
  path?: string;
  write: (chunk: string) => void;
  close(): Promise<void>;
};

type Config = {
  keyFilename: string;
  projectId: string;
  location: string;
  useLegacySql: boolean;
  maximumBytesBilled?: string;
  dryRunOnSave: {
    enabled: boolean;
    allowedLanguageIds: Array<string>;
    allowedExtensions: Array<string>;
  };
  output: {
    destination: {
      type: OutputDestination;
      file: {
        path: string;
      };
    };
    format: {
      type: OutputFormat;
      csv: {
        header: boolean;
        delimiter: string;
      };
      json: {
        space?: string;
      };
    };
  };
};

type OutputDestination = "output" | "file";

const formats = ["table", "json", "csv"] as const;
type OutputFormat = typeof formats[number];

const extensions = [".txt", ".json", ".csv"] as const;
type OutputExtension = typeof extensions[number];

class ErrorWithId {
  constructor(public error: unknown, public id: string) {}
}

let config: Config;
let outputChannel: OutputChannel;
let diagnosticCollection: DiagnosticCollection;

export async function activate(ctx: ExtensionContext) {
  try {
    outputChannel = window.createOutputChannel("BigQuery Runner");
    ctx.subscriptions.push(outputChannel);

    const section = "bigqueryRunner";
    await updateConfig(section);

    diagnosticCollection =
      languages.createDiagnosticCollection("bigqueryRunner");
    ctx.subscriptions.push(
      diagnosticCollection,
      workspace.onDidOpenTextDocument((document) =>
        checkError({ config, diagnosticCollection, document })
      ),
      workspace.onDidSaveTextDocument((document) =>
        checkError({ config, diagnosticCollection, document })
      )
    );

    // Register all available commands and their actions.
    // CommandMap describes a map of extension commands (defined in package.json)
    // and the function they invoke.
    new Map<string, () => void>([
      [`${section}.run`, wrap({ callback: run })],
      [`${section}.dryRun`, wrap({ callback: dryRun })],
    ]).forEach((action, name) => {
      ctx.subscriptions.push(commands.registerCommand(name, action));
    });

    ctx.subscriptions.push(
      // Listen for configuration changes and trigger an update, so that users don't
      // have to reload the VS Code environment after a config update.
      workspace.onDidChangeConfiguration(async (event) => {
        if (!event.affectsConfiguration(section)) {
          return;
        }
        await updateConfig(section);
      })
    );
  } catch (err) {
    window.showErrorMessage(`${err}`);
  }
}

export function deactivate() {}

async function checkError({
  config,
  document,
}: {
  config: Config;
  diagnosticCollection: DiagnosticCollection;
  document: TextDocument;
}): Promise<void> {
  if (!config.dryRunOnSave.enabled) {
    return;
  }
  if (!isBigQuery({ config, document })) {
    return;
  }
  const logger = createLogWriter();
  await dryRun({
    diagnosticCollection,
    document,
    logger,
  });
}

function isBigQuery({
  config,
  document,
}: {
  config: Config;
  document: TextDocument;
}): boolean {
  return (
    config.dryRunOnSave.allowedLanguageIds.includes(document.languageId) ||
    config.dryRunOnSave.allowedExtensions.includes(extname(document.fileName))
  );
}

async function updateConfig(section: string): Promise<void> {
  try {
    config = deepmerge(config, workspace.getConfiguration(section));
  } catch (e) {
    throw new Error(`failed to read config: ${e}`);
  }
}

function wrap({
  callback,
}: {
  callback: (params: {
    diagnosticCollection: DiagnosticCollection;
    document: TextDocument;
    range?: Range;
    logger: Writer;
  }) => Promise<void>;
}): () => void {
  return async () => {
    const logWriter = createLogWriter();
    const errorWriter = createErrorWriter();
    try {
      if (!window.activeTextEditor) {
        throw new Error("no active text editor");
      }
      await callback({
        diagnosticCollection,
        document: window.activeTextEditor.document,
        range: window.activeTextEditor.selection,
        logger: logWriter,
      });
    } catch (err) {
      if (err instanceof ErrorWithId) {
        errorWriter.write(`${err.error} (${err.id})\n`);
      } else {
        errorWriter.write(`${err}\n`);
      }
    }
  };
}

function createLogWriter(): Writer {
  return {
    write(chunk: string) {
      outputChannel.append(chunk);
    },
    async close() {},
  };
}

function createErrorWriter(): Writer {
  return {
    write(chunk: string) {
      outputChannel.show(true);
      outputChannel.append(chunk);
    },
    async close() {},
  };
}

async function run({
  diagnosticCollection,
  document,
  range,
  logger,
}: {
  diagnosticCollection: DiagnosticCollection;
  document: TextDocument;
  range?: Range;
  logger: Writer;
}): Promise<void> {
  const marker = createErrorMarker({
    diagnosticCollection,
    document,
  });
  marker.clear();

  let job!: Job;
  const queryText = getQueryText({ document, range });

  try {
    job = await createJob({
      queryText,
    });
  } catch (err) {
    marker.mark(err);
  }

  try {
    const output = await createOutput({
      filename: document.fileName,
      logger,
    });

    logger.write(`Run: ${job.id}\n`);
    const res = await job.getQueryResults({
      autoPaginate: true,
    });
    const [rows] = res;
    logger.write(`Result: ${rows.length} rows\n`);

    switch (config.output.format.type) {
      case "table":
        const t = new EasyTable();
        rows.forEach((row) => {
          tenderize(row).forEach((o) => {
            Object.keys(o).forEach((key) => t.cell(key, o[key]));
            t.newRow();
          });
        });
        output.write(t.toString().trimEnd());
        break;
      case "json":
        rows.forEach((row) => {
          output.write(
            JSON.stringify(
              flatten(row, { safe: true }),
              null,
              config.output.format.json.space
            )
          );
        });
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
              }
              resolve();
            }
          );
        });
        break;
      default:
        throw new Error(`Invalid output.format: ${config.output.format}`);
    }

    if (output.path) {
      const { path } = output;
      const selection = await window.showInformationMessage(
        `Ouput result to ${path}`,
        "Open"
      );
      switch (selection) {
        case "Open":
          const textDocument = await workspace.openTextDocument(path);
          window.showTextDocument(textDocument, 1, false);
          break;
      }
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
  diagnosticCollection,
  document,
  range,
  logger,
}: {
  diagnosticCollection: DiagnosticCollection;
  document: TextDocument;
  range?: Range;
  logger: Writer;
}): Promise<void> {
  const marker = createErrorMarker({
    diagnosticCollection,
    document,
  });
  marker.clear();

  try {
    const job = await createJob({
      queryText: getQueryText({ document, range }),
      dryRun: true,
    });
    logger.write(`Dry run: ${job.id}\n`);
    const { totalBytesProcessed } = job.metadata.statistics;
    const bytes =
      typeof totalBytesProcessed === "number"
        ? totalBytesProcessed
        : typeof totalBytesProcessed === "string"
        ? parseInt(totalBytesProcessed, 10)
        : undefined;
    if (bytes !== undefined) {
      logger.write(`Result: ${formatBytes(bytes)} processed\n`);
    }
  } catch (err) {
    marker.mark(err);
  }
}

function getQueryText({
  document,
  range,
}: {
  document: TextDocument;
  range?: Range;
}): string {
  const text = range?.isEmpty ? document.getText() : document.getText(range);

  if (text.trim() === "") {
    throw new Error("text is empty");
  }

  return text;
}

async function createJob({
  queryText,
  dryRun,
}: {
  queryText: string;
  dryRun?: boolean;
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
  diagnosticCollection: DiagnosticCollection;
  document: TextDocument;
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

async function createOutput({
  filename,
  logger,
}: {
  filename: string;
  logger: Writer;
}): Promise<Writer> {
  switch (config.output.destination.type) {
    case "output":
      return {
        write(chunk: string) {
          outputChannel.show(true);
          outputChannel.append(chunk);
          outputChannel.append("\n");
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
      logger.write(`Output to: ${path}\n`);
      const stream = createWriteStream(path);
      return {
        path,
        write: (chunk) => stream.write(chunk),
        async close() {
          return new Promise((resolve, reject) => {
            logger.write(
              `Total bytes written: ${formatBytes(stream.bytesWritten)}\n`
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
