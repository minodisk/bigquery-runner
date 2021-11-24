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
      [`${section}.runAsQuery`, wrap(runAsQuery, config, output)],
      [
        `${section}.runSelectedAsQuery`,
        wrap(runSelectedAsQuery, config, output),
      ],
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
      output.appendLine(`Error: ${err}`);
    }
  };
}

async function runAsQuery(
  textEditor: vscode.TextEditor,
  config: Config,
  output: Output
): Promise<void> {
  await query(getQueryText(textEditor), config, output);
}

async function runSelectedAsQuery(
  textEditor: vscode.TextEditor,
  config: Config,
  output: Output
): Promise<void> {
  await query(getQueryText(textEditor, true), config, output);
}

async function dryRun(
  textEditor: vscode.TextEditor,
  config: Config,
  output: Output
): Promise<void> {
  await query(getQueryText(textEditor), config, output, true);
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
  try {
    output.show(config.preserveFocus);
    output.appendLine(`Start job`);

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

    if (isDryRun) {
      let totalBytesProcessed = job.metadata.statistics.totalBytesProcessed;
      output.show(config.preserveFocus);
      output.appendLine(
        `[${job.id}] Dry run result: Total bytes processed: ${totalBytesProcessed}`
      );
      return;
    }
    output.show(config.preserveFocus);
    output.appendLine(`[${job.id}] Get job results: `);

    try {
      const results = await job.getQueryResults({
        autoPaginate: true,
      });
      output.show(config.preserveFocus);
      output.appendLine(`[${job.id}] Query results:`);
      writeResults(results[0], config, output);
    } catch (err) {
      throw new Error(`failed to get results: ${err}`);
    }
  } catch (err) {
    throw new Error(`failed to query: ${err}`);
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
      output.appendLine(t.toString());
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

function getQueryText(
  editor: vscode.TextEditor,
  onlySelected?: boolean
): string {
  if (!editor) {
    throw new Error("no active editor window was found");
  }

  // Only return the selected text
  if (onlySelected) {
    let selection = editor.selection;
    if (selection.isEmpty) {
      throw new Error("no text is currently selected");
    }
    return editor.document.getText(selection).trim();
  }

  let text = editor.document.getText().trim();
  if (!text) {
    throw new Error("the editor window is empty");
  }

  return text;
}
