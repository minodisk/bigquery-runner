import {
  AuthenticationError,
  createClient,
  NoPageTokenError,
  RunJob,
} from "core";
import { Metadata, Page, Routine, Struct, Table } from "types";
import { OutputChannel, window, workspace } from "vscode";
import { ConfigManager } from "./configManager";
import { Downloader } from "./downloader";
import { ErrorMarker } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import { Renderer, RendererManager } from "./renderer";

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
  errorMarker,
}: Readonly<{
  configManager: ConfigManager;
  outputChannel: OutputChannel;
  rendererManager: RendererManager;
  downloader: Downloader;
  errorMarker: ErrorMarker;
}>) {
  const jobs = new Map<Renderer, RunJob>();

  return {
    async run(): Promise<void> {
      try {
        if (!window.activeTextEditor) {
          throw new Error(`no editor`);
        }
        const { document, selections, viewColumn } = window.activeTextEditor;
        const query = await getQueryText({
          document,
          selections,
        });

        outputChannel.appendLine(`Run`);

        const { fileName } = document;
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

              jobs.set(renderer, job);

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
            response,
          });
        } catch (err) {
          renderer.error();
          renderer.close();
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
        if (!window.activeTextEditor) {
          throw new Error(`no editor`);
        }
        const fileName = window.activeTextEditor.document.fileName;

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
          const job = jobs.get(renderer);
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
        if (!window.activeTextEditor) {
          throw new Error(`no editor`);
        }
        const fileName = window.activeTextEditor.document.fileName;

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
          const job = jobs.get(renderer);
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

    async download(renderer: Renderer) {
      const job = jobs.get(renderer);
      if (!job) {
        throw new Error(`no job for the renderer`);
      }

      const uri = await window.showSaveDialog({
        defaultUri:
          workspace.workspaceFolders &&
          workspace.workspaceFolders[0] &&
          workspace.workspaceFolders[0].uri,
        filters: {
          "JSON Lines": ["jsonl"],
        },
      });
      if (!uri) {
        return;
      }

      await downloader.jsonl({ uri, query: job.query });
    },

    async preview(renderer: Renderer) {
      console.log(renderer);
      // const job = jobs.get(fileName);
      // if (!job) {
      //   throw new Error(`job for ${fileName} not found`);
      // }
      // console.log("preview:", job);
    },

    onDidCloseTextDocument({ fileName }: Readonly<{ fileName: string }>) {
      const renderer = rendererManager.get(fileName);
      rendererManager.delete(fileName);
      if (!renderer) {
        return;
      }
      jobs.delete(renderer);
    },

    onDidDisposePanel(renderer: Renderer) {
      jobs.delete(renderer);
    },

    dispose() {
      jobs.clear();
    },
  };
}

export class ErrorWithId {
  constructor(public error: unknown, public id: string) {}
}
