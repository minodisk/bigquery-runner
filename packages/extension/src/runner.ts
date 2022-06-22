import { readFile } from "fs/promises";
import {
  AuthenticationError,
  createClient,
  NoPageTokenError,
  RunJob,
} from "core";
import { Metadata, Page, Routine, Struct, Table } from "types";
import { OutputChannel, Selection, ViewColumn, window } from "vscode";
import { ConfigManager } from "./configManager";
import { Downloader } from "./downloader";
import { ErrorMarker } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import { Renderer, RendererManager } from "./renderer";
import { StatusManager } from "./statusManager";

export type Runner = ReturnType<typeof createRunner>;

export type RunJobResponse = SelectResponse | RoutineResponse;

export type SelectResponse = Readonly<{
  type: "select";
  jobId: string;
  metadata: Metadata;
  structs: Array<Struct>;
  table: Table;
  page: Page;
}>;

export type RoutineResponse = Readonly<{
  type: "routine";
  jobId: string;
  metadata: Metadata;
  routine: Routine;
}>;

export function createRunner({
  configManager,
  outputChannel,
  rendererManager,
  downloader,
  statusManager,
  errorMarker,
}: Readonly<{
  configManager: ConfigManager;
  outputChannel: OutputChannel;
  rendererManager: RendererManager;
  downloader: Downloader;
  statusManager: StatusManager;
  errorMarker: ErrorMarker;
}>) {
  const selectJobs: Map<string, RunJob> = new Map();

  return {
    async run(): Promise<void> {
      try {
        let fileName: string;
        let selections!: readonly Selection[];
        let viewColumn: ViewColumn | undefined;
        let query: string;
        if (window.activeTextEditor) {
          const textEditor = window.activeTextEditor;
          fileName = textEditor.document.fileName;
          selections = textEditor.selections;
          viewColumn = textEditor.viewColumn;
          query = await getQueryText({
            document: textEditor.document,
            selections,
          });
        } else {
          const renderer = rendererManager.getActive();
          if (!renderer) {
            throw new Error("no active text editor");
          }
          fileName = renderer.fileName;
          query = await readFile(renderer.fileName, "utf-8");
        }

        outputChannel.appendLine(`Run`);
        statusManager.loadBilled({
          fileName,
        });

        let renderer!: Renderer;
        try {
          renderer = await rendererManager.create({
            fileName,
            viewColumn,
          });

          await renderer.open();

          let response: RunJobResponse;
          try {
            errorMarker.clear({ fileName });

            const config = configManager.get();
            const client = await createClient(config);
            let job = await client.createRunJob({
              query,
              maxResults: config.pagination.results,
            });

            if (
              job.metadata.statistics.numChildJobs &&
              ["SCRIPT"].some((type) => job.statementType === type)
            ) {
              // Wait for completion of table creation job
              // to get the records of the table just created.
              const routine = await job.getRoutine();
              response = {
                type: "routine",
                jobId: job.id,
                metadata: job.metadata,
                routine,
              };
            } else {
              if (
                ["CREATE_TABLE_AS_SELECT", "MERGE"].some(
                  (type) => job.statementType === type
                ) &&
                job.tableName
              ) {
                // Wait for completion of table creation job
                // to get the records of the table just created.
                job = await client.createRunJob({
                  query: `SELECT * FROM \`${job.tableName}\``,
                  maxResults: config.pagination.results,
                });
              }

              selectJobs.set(fileName, job);

              const structs = await job.getStructs();
              const table = await job.getTable();
              const page = job.getPage({ table });

              response = {
                type: "select",
                jobId: job.id,
                structs,
                metadata: job.metadata,
                table,
                page,
              };
            }

            errorMarker.clear({ fileName });
          } catch (err) {
            errorMarker.mark({ fileName, err, selections });
            throw err;
          }

          outputChannel.appendLine(`Job ID: ${response.jobId}`);
          await renderer.render({
            fileName,
            response,
          });
        } catch (err) {
          renderer.close();
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
          const renderer = rendererManager.getActive();
          if (!renderer) {
            throw new Error("no active text editor");
          }
          fileName = renderer.fileName;
        }

        const renderer = await rendererManager.create({
          fileName,
        });
        const path = await renderer.open();
        if (path !== undefined) {
          outputChannel.appendLine(`Output to: ${path}`);
        }

        let response: RunJobResponse;
        try {
          // response = await runJobManager.prevRows({ fileName });
          const job = selectJobs.get(fileName);
          if (!job) {
            throw new Error(`no job`);
          }

          const structs = await job.getPrevStructs();
          const table = await job.getTable();
          const page = job.getPage({ table });

          response = {
            type: "select",
            jobId: job.id,
            structs,
            metadata: job.metadata,
            table,
            page,
          };
        } catch (err) {
          renderer.close();
          throw err;
        }
        if (!response.structs) {
          throw new ErrorWithId("no results", response.jobId);
        }

        await renderer.render({
          fileName,
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
          const renderer = rendererManager.getActive();
          if (!renderer) {
            throw new Error("no active text editor");
          }
          fileName = renderer.fileName;
        }

        const renderer = await rendererManager.create({
          fileName,
        });
        const path = await renderer.open();
        if (path !== undefined) {
          outputChannel.appendLine(`Output to: ${path}`);
        }

        let response: RunJobResponse;
        try {
          // response = await runJobManager.nextRows({ fileName });
          const job = selectJobs.get(fileName);
          if (!job) {
            throw new Error(`no job`);
          }

          const structs = await job.getNextStructs();
          const table = await job.getTable();
          const page = job.getPage({ table });

          response = {
            type: "select",
            jobId: job.id,
            structs,
            metadata: job.metadata,
            table,
            page,
          };
        } catch (err) {
          renderer.close();
          throw err;
        }
        if (!response.structs) {
          throw new ErrorWithId("no results", response.jobId);
        }

        await renderer.render({
          fileName,
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

    async download({ fileName }: Readonly<{ fileName: string }>) {
      const uri = await window.showSaveDialog();
      if (!uri) {
        return;
      }

      const query = await readFile(fileName, "utf-8");
      console.log(fileName, uri.path, query);
      await downloader.jsonl({ uri, query });
    },

    async preview({ fileName }: Readonly<{ fileName: string }>) {
      const job = selectJobs.get(fileName);
      if (!job) {
        throw new Error(`job for ${fileName} not found`);
      }
      console.log("preview:", job);
    },

    onDidCloseTextDocument({ fileName }: Readonly<{ fileName: string }>) {
      if (rendererManager.exists({ fileName })) {
        return;
      }
      selectJobs.delete(fileName);
      rendererManager.delete({ fileName });
    },

    onDidDisposePanel({ fileName }: Readonly<{ fileName: string }>) {
      selectJobs.delete(fileName);
      rendererManager.delete({ fileName });
    },

    dispose() {
      selectJobs.clear();
    },
  };
}

export class ErrorWithId {
  constructor(public error: unknown, public id: string) {}
}
