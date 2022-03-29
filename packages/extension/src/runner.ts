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
import { Range, TextDocument, workspace } from "vscode";
import { OutputChannel, Result } from ".";
import { Config } from "./config";
import { ConfigManager } from "./configManager";
import { PanelManager } from "./panelManager";
import { Renderer } from "./renderer";
import { RunJobManager, RunJobResponse } from "./runJobManager";
import { StatusManager } from "./statusManager";

export type Runner = ReturnType<typeof createRunner>;

export function createRunner({
  outputChannel,
  outputManager,
  panelManager,
  statusManager,
  runJobManager,
  renderer,
}: {
  readonly outputChannel: OutputChannel;
  readonly outputManager: OutputManager;
  readonly panelManager: PanelManager;
  readonly statusManager: StatusManager;
  readonly runJobManager: RunJobManager;
  readonly renderer: Renderer;
}) {
  return {
    async run({
      document,
      selection,
    }: {
      readonly document: TextDocument;
      readonly selection?: Range;
    }): Promise<Result> {
      let output!: Output;
      try {
        outputChannel.appendLine(`Run`);
        statusManager.loadBilled({
          document,
        });

        output = await outputManager.createOutput({ document });
        const path = await output.open();
        if (path !== undefined) {
          outputChannel.appendLine(`Output to: ${path}`);
        }

        const response = await runJobManager.rows({ document, selection });
        outputChannel.appendLine(`Job ID: ${response.jobId}`);
        await renderer.render({
          document,
          output,
          response,
        });

        return { jobId: response.jobId };
      } catch (err) {
        output.close();
        statusManager.errorBilled({ document });
        throw err;
      }
    },

    async gotoPrevPage({ document }: { readonly document: TextDocument }) {
      const output = await outputManager.createOutput({
        document,
      });
      const path = await output.open();
      if (path !== undefined) {
        outputChannel.appendLine(`Output to: ${path}`);
      }

      let response: RunJobResponse;
      try {
        response = await runJobManager.prevRows({ document });
      } catch (err) {
        output.close();
        throw err;
      }
      if (!response.results) {
        throw new ErrorWithId("no results", response.jobId);
      }

      await renderer.render({
        document,
        output,
        response,
      });

      return { jobId: response.jobId };
    },

    async gotoNextPage({ document }: { readonly document: TextDocument }) {
      const output = await outputManager.createOutput({
        document,
      });
      const path = await output.open();
      if (path !== undefined) {
        outputChannel.appendLine(`Output to: ${path}`);
      }

      let response: RunJobResponse;
      try {
        response = await runJobManager.nextRows({ document });
      } catch (err) {
        output.close();
        throw err;
      }
      if (!response.results) {
        throw new ErrorWithId("no results", response.jobId);
      }

      await renderer.render({
        document,
        output,
        response,
      });

      return { jobId: response.jobId };
    },

    onDidCloseTextDocument({ document }: { readonly document: TextDocument }) {
      if (panelManager.exists({ document })) {
        return;
      }
      runJobManager.delete({ document });
      panelManager.delete({ document });
    },

    onDidDisposePanel({ document }: { readonly document: TextDocument }) {
      if (
        workspace.textDocuments.some((d) => d.fileName === document.fileName)
      ) {
        return;
      }
      runJobManager.delete({ document });
      panelManager.delete({ document });
    },

    dispose() {
      // do nothing
    },
  };
}

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
    async createOutput({
      document,
    }: {
      readonly document: TextDocument;
    }): Promise<Output> {
      const config = configManager.get();
      switch (config.output.type) {
        case "viewer": {
          const panel = await panelManager.get({ document });
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
            `${basename(
              document.fileName,
              extname(document.fileName)
            )}${formatToExtension(formatter.type)}`
          );
          const stream = createWriteStream(path, "utf-8");

          await mkdirp(dirname);
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

export function getQueryText({
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

export class ErrorWithId {
  constructor(public error: unknown, public id: string) {}
}
