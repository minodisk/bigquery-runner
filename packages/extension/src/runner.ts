import { AuthenticationError, NoPageTokenError, Output } from "core";
import { isNextEvent, isPrevEvent, ViewerEvent } from "core/src/types";
import { readFile } from "fs/promises";
import { Selection, ViewColumn, window } from "vscode";
import { OutputChannel } from ".";
import { ErrorMarker } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import { OutputManager } from "./outputManager";
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
  errorMarker,
}: {
  readonly outputChannel: OutputChannel;
  readonly outputManager: OutputManager;
  readonly panelManager: PanelManager;
  readonly statusManager: StatusManager;
  readonly runJobManager: RunJobManager;
  readonly renderer: Renderer;
  readonly errorMarker: ErrorMarker;
}) {
  return {
    async run(): Promise<void> {
      try {
        let fileName: string;
        let query: string;
        let selection: Selection | undefined;
        let viewColumn: ViewColumn | undefined;
        if (window.activeTextEditor) {
          const textEditor = window.activeTextEditor;
          fileName = textEditor.document.fileName;
          query = await getQueryText({
            document: textEditor.document,
            range: textEditor.selection,
          });
          selection = textEditor.selection;
          viewColumn = textEditor.viewColumn;
        } else {
          const panel = panelManager.getActive();
          if (!panel) {
            throw new Error("no active text editor");
          }
          fileName = panel.fileName;
          query = await readFile(panel.fileName, "utf-8");
        }

        outputChannel.appendLine(`Run`);
        statusManager.loadBilled({
          fileName,
        });

        let output!: Output;
        try {
          output = await outputManager.create({
            fileName,
            viewColumn,
          });
          const path = await output.open();
          if (path !== undefined) {
            outputChannel.appendLine(`Output to: ${path}`);
          }

          let response: RunJobResponse;
          try {
            errorMarker.clear({ fileName });
            response = await runJobManager.rows({
              fileName,
              query,
            });
            errorMarker.clear({ fileName });
          } catch (err) {
            errorMarker.mark({ fileName, err, selection });
            throw err;
          }

          outputChannel.appendLine(`Job ID: ${response.jobId}`);
          await renderer.render({
            fileName,
            output,
            response,
          });
        } catch (err) {
          output.close();
          statusManager.errorBilled({ fileName });
          throw err;
        }
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
    },

    async gotoPrevPage(): Promise<void> {
      try {
        let fileName: string;
        if (window.activeTextEditor) {
          const textEditor = window.activeTextEditor;
          fileName = textEditor.document.fileName;
        } else {
          const panel = panelManager.getActive();
          if (!panel) {
            throw new Error("no active text editor");
          }
          fileName = panel.fileName;
        }

        const output = await outputManager.create({
          fileName,
        });
        const path = await output.open();
        if (path !== undefined) {
          outputChannel.appendLine(`Output to: ${path}`);
        }

        let response: RunJobResponse;
        try {
          response = await runJobManager.prevRows({ fileName });
        } catch (err) {
          output.close();
          throw err;
        }
        if (!response.results) {
          throw new ErrorWithId("no results", response.jobId);
        }

        await renderer.render({
          fileName,
          output,
          response,
        });
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
    },

    async gotoNextPage(): Promise<void> {
      try {
        let fileName: string;
        if (window.activeTextEditor) {
          const textEditor = window.activeTextEditor;
          fileName = textEditor.document.fileName;
        } else {
          const panel = panelManager.getActive();
          if (!panel) {
            throw new Error("no active text editor");
          }
          fileName = panel.fileName;
        }

        const output = await outputManager.create({
          fileName,
        });
        const path = await output.open();
        if (path !== undefined) {
          outputChannel.appendLine(`Output to: ${path}`);
        }

        let response: RunJobResponse;
        try {
          response = await runJobManager.nextRows({ fileName });
        } catch (err) {
          output.close();
          throw err;
        }
        if (!response.results) {
          throw new ErrorWithId("no results", response.jobId);
        }

        await renderer.render({
          fileName,
          output,
          response,
        });
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
    },

    onDidCloseTextDocument({ fileName }: { readonly fileName: string }) {
      if (panelManager.exists({ fileName })) {
        return;
      }
      runJobManager.delete({ fileName });
      panelManager.delete({ fileName });
    },

    async onDidReceiveMessage(e: ViewerEvent) {
      if (isPrevEvent(e)) {
        await this.gotoPrevPage();
        return;
      }
      if (isNextEvent(e)) {
        await this.gotoNextPage();
        return;
      }
    },

    onDidDisposePanel({ fileName }: { readonly fileName: string }) {
      runJobManager.delete({ fileName });
      panelManager.delete({ fileName });
    },

    dispose() {
      // do nothing
    },
  };
}

export class ErrorWithId {
  constructor(public error: unknown, public id: string) {}
}
