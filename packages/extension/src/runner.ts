import { randomUUID } from "crypto";
import { createClient } from "core";
import {
  Metadata,
  Page,
  Routine,
  RunnerID,
  Struct,
  Table,
  unwrap,
} from "types";
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
import { RendererManager } from "./renderer";

export type RunnerManager = ReturnType<typeof createRunnerManager>;
export type RunJobResponse = SelectResponse | RoutineResponse;
export type Runner = {
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
      title,
      fileName,
      selections,
      baseViewColumn,
    }: Readonly<{
      query: string;
      title: string;
      fileName?: string;
      selections?: readonly Selection[];
      baseViewColumn?: ViewColumn;
    }>) {
      const runnerId = randomUUID() as RunnerID;

      outputChannel.appendLine(`Run`);

      const rendererCreateResult = await rendererManager.create({
        runnerId,
        title,
        baseViewColumn,
      });
      if (!rendererCreateResult.success) {
        const { reason } = unwrap(rendererCreateResult);
        outputChannel.appendLine(reason);
        return;
      }
      const renderer = unwrap(rendererCreateResult);

      const rendererOpenResult = await renderer.open();
      if (!rendererOpenResult.success) {
        const { reason } = unwrap(rendererOpenResult);
        outputChannel.appendLine(reason);
        return;
      }

      if (fileName) {
        errorMarker.clear({
          fileName,
        });
      }

      const config = configManager.get();

      const clientResult = await createClient(config);
      if (!clientResult.success) {
        const { reason } = unwrap(clientResult);
        outputChannel.appendLine(reason);
        await window.showErrorMessage(reason);
        renderer.error();
        await renderer.close();
        if (fileName) {
          errorMarker.mark({
            fileName,
            err: reason,
            selections: selections ?? [],
          });
        }
        return;
      }
      const client = unwrap(clientResult);

      const jobResult = await client.createRunJob({
        query,
        maxResults: config.pagination.results,
      });
      if (!jobResult.success) {
        const { reason } = unwrap(jobResult);
        outputChannel.appendLine(reason);
        renderer.error();
        await renderer.close();
        if (fileName) {
          errorMarker.mark({
            fileName,
            err: reason,
            selections: selections ?? [],
          });
        }
        return;
      }
      const job = unwrap(jobResult);

      outputChannel.appendLine(`Job ID: ${job.id}`);

      const renderMedatadaResult = await renderer.renderMetadata(job.metadata);
      if (!renderMedatadaResult.success) {
        const { reason } = unwrap(renderMedatadaResult);
        outputChannel.appendLine(reason);
        renderer.error();
        await renderer.close();
        if (fileName) {
          errorMarker.mark({
            fileName,
            err: reason,
            selections: selections ?? [],
          });
        }
        return;
      }

      if (
        job.metadata.statistics.numChildJobs &&
        ["SCRIPT"].some((type) => job.statementType === type)
      ) {
        // Wait for completion of table creation job
        // to get the records of the table just created.
        const routineResult = await job.getRoutine();
        if (!routineResult.success) {
          const { reason } = unwrap(routineResult);
          outputChannel.appendLine(reason);
          renderer.error();
          await renderer.close();
          if (fileName) {
            errorMarker.mark({
              fileName,
              err: reason,
              selections: selections ?? [],
            });
          }
          return;
        }
        const routine = unwrap(routineResult);

        const renderRoutineResult = await renderer.renderRoutine(routine);
        if (!renderRoutineResult.success) {
          const { reason } = unwrap(renderRoutineResult);
          outputChannel.appendLine(reason);
          renderer.error();
          await renderer.close();
          if (fileName) {
            errorMarker.mark({
              fileName,
              err: reason,
              selections: selections ?? [],
            });
          }
          return;
        }
        return;
      }

      const tableResult = await job.getTable();
      if (!tableResult.success) {
        const { reason } = unwrap(tableResult);
        outputChannel.appendLine(reason);
        renderer.error();
        await renderer.close();
        if (fileName) {
          errorMarker.mark({
            fileName,
            err: reason,
            selections: selections ?? [],
          });
        }
        return;
      }
      const table = unwrap(tableResult);

      const renderTableResult = await renderer.renderTable(table);
      if (!renderTableResult.success) {
        const { reason } = unwrap(renderTableResult);
        outputChannel.appendLine(reason);
        renderer.error();
        await renderer.close();
        if (fileName) {
          errorMarker.mark({
            fileName,
            err: reason,
            selections: selections ?? [],
          });
        }
        return;
      }

      if (
        ["CREATE_TABLE_AS_SELECT", "MERGE"].some(
          (type) => job.statementType === type
        )
      ) {
        // doesn't have any rows
        return;
      }

      const getStructsResult = await job.getStructs();
      if (!getStructsResult.success) {
        const { reason } = unwrap(getStructsResult);
        outputChannel.appendLine(reason);
        renderer.error();
        await renderer.close();
        if (fileName) {
          errorMarker.mark({
            fileName,
            err: reason,
            selections: selections ?? [],
          });
        }
        return;
      }
      const structs = unwrap(getStructsResult);

      const page = job.getPage(table);

      const renderRowsResult = await renderer.renderRows({
        metadata: job.metadata,
        structs,
        table,
        page,
      });
      if (!renderRowsResult.success) {
        const { reason } = unwrap(renderRowsResult);
        outputChannel.appendLine(reason);
        renderer.error();
        await renderer.close();
        if (fileName) {
          errorMarker.mark({
            fileName,
            err: reason,
            selections: selections ?? [],
          });
        }
        return;
      }

      if (fileName) {
        errorMarker.clear({
          fileName,
        });
      }

      const runner: Runner = {
        isSaveFileName(f) {
          return f === fileName;
        },

        async prev() {
          const rendererCreateResult = await rendererManager.create({
            runnerId,
            title,
            baseViewColumn,
          });
          if (!rendererCreateResult.success) {
            const { reason } = unwrap(rendererCreateResult);
            outputChannel.appendLine(reason);
            return;
          }
          const renderer = unwrap(rendererCreateResult);

          renderer.reveal();

          const rendererOpenResult = await renderer.open();
          if (!rendererOpenResult.success) {
            const { reason } = unwrap(rendererOpenResult);
            outputChannel.appendLine(reason);
            return;
          }

          const tableResult = await job.getTable();
          if (!tableResult.success) {
            const { reason } = unwrap(tableResult);
            outputChannel.appendLine(reason);
            await renderer.close();
            return;
          }
          const { value: table } = tableResult;

          const renderTableResult = await renderer.renderTable(table);
          if (!renderTableResult.success) {
            const { reason } = unwrap(renderTableResult);
            outputChannel.appendLine(reason);
            await renderer.close();
            return;
          }

          const structsResult = await job.getPrevStructs();
          if (!structsResult.success) {
            const { type, reason } = unwrap(structsResult);
            outputChannel.appendLine(reason);
            if (type === "NoPageToken") {
              await window.showErrorMessage(reason);
            }
            await renderer.close();
            return;
          }
          const { value: structs } = structsResult;

          const page = job.getPage(table);
          const renderRowsResult = await renderer.renderRows({
            metadata: job.metadata,
            structs,
            table,
            page,
          });
          if (!renderRowsResult.success) {
            const { reason } = unwrap(renderRowsResult);
            outputChannel.appendLine(reason);
            await renderer.close();
            return;
          }
        },

        async next() {
          const rendererCreateResult = await rendererManager.create({
            runnerId,
            title,
            baseViewColumn,
          });
          if (!rendererCreateResult.success) {
            const { reason } = unwrap(rendererCreateResult);
            outputChannel.appendLine(reason);
            return;
          }
          const renderer = unwrap(rendererCreateResult);

          renderer.reveal();

          const rendererOpenResult = await renderer.open();
          if (!rendererOpenResult.success) {
            const { reason } = unwrap(rendererOpenResult);
            outputChannel.appendLine(reason);
            return;
          }

          const getTableResult = await job.getTable();
          if (!getTableResult.success) {
            const { reason } = unwrap(getTableResult);
            outputChannel.appendLine(reason);
            await renderer.close();
            return;
          }
          const { value: table } = getTableResult;

          const renderTableResult = await renderer.renderTable(table);
          if (!renderTableResult.success) {
            const { reason } = unwrap(renderTableResult);
            outputChannel.appendLine(reason);
            await renderer.close();
            return;
          }

          const getStructsResult = await job.getNextStructs();
          if (!getStructsResult.success) {
            const { type, reason } = unwrap(getStructsResult);
            outputChannel.appendLine(reason);
            if (type === "NoPageToken") {
              await window.showErrorMessage(reason);
            }
            await renderer.close();
            return;
          }
          const { value: structs } = getStructsResult;

          const page = job.getPage(table);
          const renderRowsResult = await renderer.renderRows({
            metadata: job.metadata,
            structs,
            table,
            page,
          });
          if (!renderRowsResult.success) {
            const { reason } = unwrap(renderRowsResult);
            outputChannel.appendLine(reason);
            await renderer.close();
            return;
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
          if (!job.tableName) {
            throw new Error(`preview is failed: table name is not defined`);
          }
          const query = `SELECT * FROM ${job.tableName}`;
          await runnerManager.create({
            title: job.tableName,
            query,
            baseViewColumn: renderer.viewColumn,
          });
        },

        dispose() {
          if (rendererManager.exists(runnerId)) {
            return;
          }
          runners.delete(runnerId);
        },
      };
      runners.set(runnerId, runner);
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
