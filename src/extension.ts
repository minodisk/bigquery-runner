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

"use strict";
import * as CSV from "csv-stringify";
import EasyTable from "easy-table";
import { flatten } from "flat";
import { createWriteStream } from "fs";
import { tenderize } from "tenderizer";
import {
  commands,
  ExtensionContext,
  OutputChannel,
  TextEditor,
  window,
  workspace,
} from "vscode";
import { BigQuery, Job } from "@google-cloud/bigquery";
import { basename, extname, join } from "path";
import deepmerge from "deepmerge";
import mkdirp from "mkdirp";

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
  preserveFocus: boolean;
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

export async function activate(ctx: ExtensionContext) {
  try {
    outputChannel = window.createOutputChannel("BigQuery Runner");
    const section = "bigqueryRunner";
    await updateConfig(section);

    // Register all available commands and their actions.
    // CommandMap describes a map of extension commands (defined in package.json)
    // and the function they invoke.
    new Map<string, () => void>([
      [`${section}.run`, wrap({ callback: run })],
      [`${section}.dryRun`, wrap({ callback: dryRun })],
    ]).forEach((action, name) => {
      ctx.subscriptions.push(commands.registerCommand(name, action));
    });

    // Listen for configuration changes and trigger an update, so that users don't
    // have to reload the VS Code environment after a config update.
    ctx.subscriptions.push(
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

export function deactivate() {
  outputChannel.dispose();
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
  callback: (params: { editor: TextEditor; logger: Writer }) => Promise<void>;
}): () => void {
  return async () => {
    const logger = createLogger();
    try {
      if (!window.activeTextEditor) {
        throw new Error("no active text editor");
      }
      await callback({
        editor: window.activeTextEditor,
        logger,
      });
    } catch (err) {
      if (err instanceof ErrorWithId) {
        logger.write(`${err.error} (${err.id})\n`);
      } else {
        logger.write(`${err}`);
      }
    } finally {
      logger.write(`\n`);
    }
  };
}

function createLogger(): Writer {
  return {
    write(chunk: string) {
      outputChannel.append(chunk);
    },
    async close() {
      outputChannel.dispose();
    },
  };
}

async function run({
  editor,
  logger,
}: {
  editor: TextEditor;
  logger: Writer;
}): Promise<void> {
  const job = await createJob({
    queryText: getQueryText(editor),
  });
  try {
    const output = await createOutput({
      filename: editor.document.fileName,
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
  editor,
  logger,
}: {
  editor: TextEditor;
  logger: Writer;
}): Promise<void> {
  const job = await createJob({
    queryText: getQueryText(editor),
    dryRun: true,
  });
  logger.write(`Dry run: ${job.id}
Result: ${job.metadata.statistics.totalBytesProcessed} bytes processed\n`);
}

function getQueryText(editor: TextEditor): string {
  if (!editor) {
    throw new Error("no active editor window was found");
  }

  const text = editor.selection.isEmpty
    ? editor.document.getText().trim()
    : editor.document.getText(editor.selection).trim();

  if (!text) {
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
            logger.write(`Total bytes written: ${stream.bytesWritten}bytes\n`);
            stream.on("error", reject).on("finish", resolve).end();
          });
        },
      };
  }
}

function formatToExtension(format: OutputFormat): OutputExtension {
  return extensions[formats.indexOf(format)];
}
