import { randomUUID } from "crypto";
import {
  AuthenticationError,
  createClient,
  NoPageTokenError,
  RunJob,
} from "core";
import { Metadata, Page, Routine, RunnerID, Struct, Table } from "types";
import {
  OutputChannel,
  Selection,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import { ConfigManager } from "./configManager";
import { Downloader } from "./downloader";
import { ErrorMarker } from "./errorMarker";
import { Renderer, RendererManager } from "./renderer";

export type RunnerManager = ReturnType<typeof createRunnerManager>;
export type RunJobResponse = SelectResponse | RoutineResponse;
export type Runner = {
  disposed: boolean;
  isSaveFileName: (fileName: string) => boolean;
  prev: () => Promise<void>;
  next: () => Promise<void>;
  download: () => Promise<void>;
  preview: () => Promise<void>;
  dispose: () => void;
};

export type SelectResponse = Readonly<{
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

export function createRunnerManager({
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
  const runners = new Map<RunnerID, Runner>();

  const runnerManager = {
    async create({
      query,
      fileName,
      selections,
      viewColumn,
    }: Readonly<{
      query: string;
      fileName?: string;
      selections?: readonly Selection[];
      viewColumn?: ViewColumn;
    }>) {
      const runnerId = randomUUID() as RunnerID;
      let renderer!: Renderer;
      let job!: RunJob;

      const runner: Runner = {
        disposed: false,

        isSaveFileName(f) {
          return f === fileName;
        },

        async prev() {
          try {
            if (renderer.disposed) {
              renderer = await rendererManager.create({ runnerId, viewColumn });
            }
            renderer.reveal();

            const path = await renderer.open();
            if (path !== undefined) {
              outputChannel.appendLine(`Output to: ${path}`);
            }

            try {
              const table = await job.getTable();
              renderer.renderTable({ table });

              const structs = await job.getPrevStructs();
              const page = job.getPage({ table });
              renderer.renderRows({
                metadata: job.metadata,
                structs,
                table,
                page,
              });
            } catch (err) {
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

        async next() {
          try {
            if (renderer.disposed) {
              renderer = await rendererManager.create({ runnerId, viewColumn });
            }
            renderer.reveal();

            const path = await renderer.open();
            if (path !== undefined) {
              outputChannel.appendLine(`Output to: ${path}`);
            }

            try {
              const table = await job.getTable();
              renderer.renderTable({ table });

              const structs = await job.getNextStructs();
              const page = job.getPage({ table });
              renderer.renderRows({
                metadata: job.metadata,
                structs,
                table,
                page,
              });
            } catch (err) {
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

        async download() {
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

        async preview() {
          const query = `SELECT * FROM ${job.tableName}`;
          await runnerManager.create({
            query,
            viewColumn: renderer.viewColumn,
          });
        },

        dispose() {
          if (!renderer.disposed) {
            return;
          }
          this.disposed = true;
          runners.delete(runnerId);
        },
      };
      runners.set(runnerId, runner);

      try {
        outputChannel.appendLine(`Run`);

        try {
          renderer = await rendererManager.create({ runnerId, viewColumn });

          await renderer.open();

          try {
            if (fileName) {
              errorMarker.clear({
                fileName,
              });
            }

            const config = configManager.get();
            const client = await createClient(config);
            job = await client.createRunJob({
              query,
              maxResults: config.pagination.results,
            });
            outputChannel.appendLine(`Job ID: ${job.id}`);

            renderer.renderMetadata({ metadata: job.metadata });

            if (
              job.metadata.statistics.numChildJobs &&
              ["SCRIPT"].some((type) => job.statementType === type)
            ) {
              // Wait for completion of table creation job
              // to get the records of the table just created.
              const routine = await job.getRoutine();
              renderer.renderRoutine({
                routine,
              });
              return;
            }

            const table = await job.getTable();
            renderer.renderTable({ table });

            if (
              ["CREATE_TABLE_AS_SELECT", "MERGE"].some(
                (type) => job.statementType === type
              )
            ) {
              return;
            }

            const structs = await job.getStructs();
            const page = job.getPage({ table });
            renderer.renderRows({
              metadata: job.metadata,
              structs,
              table,
              page,
            });

            if (fileName) {
              errorMarker.clear({
                fileName,
              });
            }
          } catch (err) {
            if (fileName) {
              errorMarker.mark({
                fileName,
                err,
                selections: selections ?? [],
              });
            }
            throw err;
          }
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

    get({ runnerId }: Readonly<{ runnerId: RunnerID }>) {
      return runners.get(runnerId);
    },

    findWithFileName({ fileName }: Readonly<{ fileName: string }>) {
      for (const runner of runners.values()) {
        if (runner.isSaveFileName(fileName)) {
          return runner;
        }
      }
      return;
    },

    dispose() {
      runners.clear();
    },
  };

  return runnerManager;
}

export class ErrorWithId {
  constructor(public error: unknown, public id: string) {}
}
