import {
  createCSVFormatter,
  createFileOutput,
  createJSONFormatter,
  createJSONLinesFormatter,
  createLogOutput,
  createMarkdownFormatter,
  createTableFormatter,
  createViewerOutput,
  Formatter,
  Output,
} from "core";
import { createWriteStream } from "fs";
import mkdirp from "mkdirp";
import { basename, extname, join } from "path";
import { ViewColumn, workspace } from "vscode";
import { OutputChannel } from ".";
import { Config } from "./config";
import { ConfigManager } from "./configManager";
import { PanelManager } from "./panelManager";

export type OutputManager = ReturnType<typeof createOutputManager>;

export function createOutputManager({
  outputChannel,
  configManager,
  panelManager,
}: {
  readonly outputChannel: OutputChannel;
  readonly configManager: ConfigManager;
  readonly panelManager: PanelManager;
}) {
  return {
    async create({
      fileName,
      viewColumn,
    }: {
      readonly fileName: string;
      readonly viewColumn?: ViewColumn;
    }): Promise<Output> {
      const config = configManager.get();
      switch (config.output.type) {
        case "viewer": {
          const panel = await panelManager.create({
            fileName,
            viewColumn,
          });
          return createViewerOutput({
            postMessage: panel.webview.postMessage.bind(panel.webview),
          });
        }
        case "log":
          return createLogOutput({
            formatter: createFormatter({ config }),
            outputChannel,
          });
        case "file": {
          if (!workspace.workspaceFolders || !workspace.workspaceFolders[0]) {
            throw new Error(`no workspace folders`);
          }

          const formatter = createFormatter({ config });
          const dirname = join(
            workspace.workspaceFolders[0].uri.path ||
              workspace.workspaceFolders[0].uri.fsPath,
            config.output.file.path
          );
          const path = join(
            dirname,
            `${basename(fileName, extname(fileName))}${formatToExtension(
              formatter.type
            )}`
          );
          await mkdirp(dirname);
          const stream = createWriteStream(path, "utf-8");

          return createFileOutput({
            formatter,
            stream,
          });
        }
      }
    },

    dispose() {
      // do nothing
    },
  };
}

function formatToExtension(format: Formatter["type"]): string {
  return {
    table: ".txt",
    markdown: ".md",
    "json-lines": ".jsonl",
    json: ".json",
    csv: ".csv",
  }[format];
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
