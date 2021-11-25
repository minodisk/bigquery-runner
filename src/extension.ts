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
import * as vscode from "vscode";
import { BigQuery } from "@google-cloud/bigquery";
import { stringify as toCSV } from "csv-stringify";
import EasyTable from "easy-table";
import { tenderize } from "tenderizer";
import { flatten } from "flat";

type Output = {
  show: (preserveFocus: boolean) => void;
  appendLine: (value: string) => void;
};

type Config = {
  keyFilename: string;
  projectId: string;
  location: string;
  useLegacySql: boolean;
  maximumBytesBilled?: string;
  outputFormat: OutputFormat;
  prettyPrintJSON: boolean;
  preserveFocus: boolean;
};

type OutputFormat = "json" | "csv" | "table";

export async function activate(ctx: vscode.ExtensionContext) {
  try {
    const output = vscode.window.createOutputChannel("BigQuery Runner");
    const section = "bigqueryRunner";
    const config: Config = {
      keyFilename: "",
      projectId: "",
      useLegacySql: false,
      location: "US",
      preserveFocus: true,
      outputFormat: "json",
      prettyPrintJSON: true,
    };
    await readConfig(section, config);

    // Register all available commands and their actions.
    // CommandMap describes a map of extension commands (defined in package.json)
    // and the function they invoke.
    new Map<string, () => void>([
      [`${section}.run`, wrap(run, config, output)],
      [`${section}.dryRun`, wrap(dryRun, config, output)],
    ]).forEach((action, name) => {
      ctx.subscriptions.push(vscode.commands.registerCommand(name, action));
    });

    // Listen for configuration changes and trigger an update, so that users don't
    // have to reload the VS Code environment after a config update.
    ctx.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (!event.affectsConfiguration(section)) {
          return;
        }
        await readConfig(section, config);
      })
    );
  } catch (err) {
    vscode.window.showErrorMessage(`${err}`);
  }
}

export function deactivate() {}

async function readConfig(section: string, config: Config): Promise<void> {
  try {
    const c = vscode.workspace.getConfiguration(section);
    config.keyFilename = c.get<string>("keyFilename") ?? config.keyFilename;
    config.projectId = c.get<string>("projectId") ?? config.projectId;
    config.useLegacySql = c.get<boolean>("useLegacySql") ?? config.useLegacySql;
    config.location = c.get<string>("location") ?? config.location;
    config.maximumBytesBilled =
      c.get<string>("maximumBytesBilled") ?? config.maximumBytesBilled;
    config.preserveFocus =
      c.get<boolean>("preserveFocus") ?? config.preserveFocus;
    config.outputFormat =
      c.get<OutputFormat>("outputFormat") ?? config.outputFormat;
    config.prettyPrintJSON =
      c.get<boolean>("prettyPrintJSON") ?? config.prettyPrintJSON;
  } catch (e) {
    throw new Error(`failed to read config: ${e}`);
  }
}

function wrap(
  fn: (
    editor: vscode.TextEditor,
    config: Config,
    output: Output
  ) => Promise<void>,
  config: Config,
  output: Output
): () => void {
  return async () => {
    try {
      if (!vscode.window.activeTextEditor) {
        throw new Error("no active text editor");
      }
      await fn(vscode.window.activeTextEditor, config, output);
    } catch (err) {
      output.show(config.preserveFocus);
      if (err instanceof ErrorWithId) {
        output.appendLine(`${err} (${err.id})`);
      } else {
        output.appendLine(`${err}`);
      }
    } finally {
      output.appendLine(``);
    }
  };
}

async function run(
  textEditor: vscode.TextEditor,
  config: Config,
  output: Output
): Promise<void> {
  await query(getQueryText(textEditor), config, output);
}

async function dryRun(
  textEditor: vscode.TextEditor,
  config: Config,
  output: Output
): Promise<void> {
  await query(getQueryText(textEditor), config, output, true);
}

class ErrorWithId {
  constructor(public error: unknown, public id: string) {}
}

/**
 * @param queryText
 * @param isDryRun Defaults to False.
 */
async function query(
  queryText: string,
  config: Config,
  output: Output,
  isDryRun?: boolean
): Promise<void> {
  const client = new BigQuery({
    keyFilename: config.keyFilename,
    projectId: config.projectId,
  });
  const data = await client.createQueryJob({
    query: queryText,
    location: config.location,
    maximumBytesBilled: config.maximumBytesBilled,
    useLegacySql: config.useLegacySql,
    dryRun: !!isDryRun,
  });

  const job = data[0];
  if (!job.id) {
    throw new Error(`no job ID`);
  }

  try {
    output.show(config.preserveFocus);
    if (isDryRun) {
      output.appendLine(`Dry run: ${job.id}`);
      output.appendLine(
        `Result: ${job.metadata.statistics.totalBytesProcessed} bytes processed`
      );
      return;
    }
    output.appendLine(`Run: ${job.id}`);

    const results = await job.getQueryResults({
      autoPaginate: true,
    });
    output.show(config.preserveFocus);
    output.appendLine(`Result: ${results[0].length} rows`);
    writeResults(results[0], config, output);
  } catch (err) {
    throw new ErrorWithId(err, job.id);
  }
}

function writeResults(rows: Array<any>, config: Config, output: Output): void {
  let format = config.outputFormat.toString().toLowerCase();
  switch (format) {
    case "csv":
      toCSV(rows, (err?: Error, res?: string) => {
        if (err) {
          throw err;
        }
        if (res) {
          output.appendLine(res);
        }
      });
      break;
    case "table":
      const t = new EasyTable();
      rows.forEach((row) => {
        tenderize(row).forEach((o) => {
          Object.keys(o).forEach((key) => t.cell(key, o[key]));
          t.newRow();
        });
      });
      output.appendLine(t.toString().trimEnd());
      break;
    default:
      let spacing = config.prettyPrintJSON ? "  " : "";
      rows.forEach((row) => {
        output.appendLine(
          JSON.stringify(flatten(row, { safe: true }), null, spacing)
        );
      });
  }
}

function getQueryText(editor: vscode.TextEditor): string {
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
