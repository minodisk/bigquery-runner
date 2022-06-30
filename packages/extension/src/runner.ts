import { createHash } from "crypto";
import { format } from "bytes";
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
import { StatusManager } from "./statusManager";

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
  statusManager,
  rendererManager,
  downloader,
  errorMarker,
}: Readonly<{
  configManager: ConfigManager;
  outputChannel: OutputChannel;
  statusManager: StatusManager;
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
      // const runnerId = randomUUID() as RunnerID;
      const runnerId = createHash("md5")
        .update(query.trimStart().trimEnd().replace(/\s+/g, " "))
        .digest("hex") as RunnerID;
      fileName = runnerId;

      outputChannel.appendLine(`Run`);

      if (fileName) {
        statusManager.loadBilled({ fileName });
      }

      const rendererCreateResult = await rendererManager.create({
        runnerId,
        title,
        baseViewColumn,
      });
      if (!rendererCreateResult.success) {
        const { reason } = unwrap(rendererCreateResult);
        outputChannel.appendLine(reason);
        if (fileName) {
          statusManager.errorBilled({ fileName });
        }
        return;
      }
      const renderer = unwrap(rendererCreateResult);

      renderer.reveal();

      const rendererOpenResult = await renderer.startLoading();
      if (!rendererOpenResult.success) {
        const { reason } = unwrap(rendererOpenResult);
        outputChannel.appendLine(reason);
        await renderer.cancelLoading();
        if (fileName) {
          statusManager.errorBilled({ fileName });
        }
        return;
      }

      const config = configManager.get();

      const clientResult = await createClient(config);
      if (!clientResult.success) {
        const { reason } = unwrap(clientResult);
        outputChannel.appendLine(reason);
        await window.showErrorMessage(reason);
        await renderer.cancelLoading();
        if (fileName) {
          statusManager.errorBilled({ fileName });
        }
        return;
      }
      const client = unwrap(clientResult);

      const runJobResult = await client.createRunJob({
        query,
        maxResults: config.pagination.results,
      });
      if (fileName) {
        errorMarker.clear({
          fileName,
        });
      }
      if (!runJobResult.success) {
        const err = unwrap(runJobResult);
        outputChannel.appendLine(err.reason);
        await renderer.cancelLoading();
        if (fileName) {
          statusManager.errorBilled({ fileName });
        }
        if (fileName) {
          if (err.type === "QueryWithPosition") {
            errorMarker.markAt({
              fileName,
              reason: err.reason,
              position: err.position,
              selections: selections ?? [],
            });
            return;
          }
          if (err.type === "Query") {
            errorMarker.markAll({
              fileName,
              reason: err.reason,
              selections: selections ?? [],
            });
            return;
          }
        }
        await window.showErrorMessage(err.reason);
        return;
      }
      if (fileName) {
        errorMarker.clear({
          fileName,
        });
      }
      const job = unwrap(runJobResult);
      const { metadata } = job;
      const {
        statistics: {
          numChildJobs,
          query: { totalBytesBilled, cacheHit },
        },
      } = metadata;

      outputChannel.appendLine(`Job ID: ${job.id}`);

      const bytes = format(parseInt(totalBytesBilled, 10));
      outputChannel.appendLine(
        `Result: ${bytes} to be billed (cache: ${cacheHit})`
      );
      if (fileName) {
        statusManager.succeedBilled({
          fileName,
          billed: {
            bytes,
            cacheHit: metadata.statistics.query.cacheHit,
          },
        });
      }

      const renderMedatadaResult = await renderer.renderMetadata(metadata);
      if (!renderMedatadaResult.success) {
        const { reason } = unwrap(renderMedatadaResult);
        outputChannel.appendLine(reason);
        await renderer.cancelLoading();
        if (fileName) {
          statusManager.errorBilled({ fileName });
        }
        return;
      }

      if (
        numChildJobs &&
        ["SCRIPT"].some((type) => job.statementType === type)
      ) {
        // Wait for completion of table creation job
        // to get the records of the table just created.
        const routineResult = await job.getRoutine();
        if (!routineResult.success) {
          const { reason } = unwrap(routineResult);
          outputChannel.appendLine(reason);
          await renderer.cancelLoading();
          if (fileName) {
            statusManager.errorBilled({ fileName });
          }
          return;
        }
        const routine = unwrap(routineResult);

        const renderRoutineResult = await renderer.renderRoutine(routine);
        if (!renderRoutineResult.success) {
          const { reason } = unwrap(renderRoutineResult);
          outputChannel.appendLine(reason);
          await renderer.cancelLoading();
          if (fileName) {
            statusManager.errorBilled({ fileName });
          }
          return;
        }
        return;
      }

      const tableResult = await job.getTable();
      if (!tableResult.success) {
        const { reason } = unwrap(tableResult);
        outputChannel.appendLine(reason);
        await renderer.cancelLoading();
        if (fileName) {
          statusManager.errorBilled({ fileName });
        }
        return;
      }
      const table = unwrap(tableResult);

      const renderTableResult = await renderer.renderTable(table);
      if (!renderTableResult.success) {
        const { reason } = unwrap(renderTableResult);
        outputChannel.appendLine(reason);
        await renderer.cancelLoading();
        if (fileName) {
          statusManager.errorBilled({ fileName });
        }
        return;
      }

      if (
        // There is rows in query result.
        !["CREATE_TABLE_AS_SELECT", "MERGE"].some(
          (type) => job.statementType === type
        )
      ) {
        const getStructsResult = await job.getStructs();
        if (!getStructsResult.success) {
          const { reason } = unwrap(getStructsResult);
          outputChannel.appendLine(reason);
          await renderer.cancelLoading();
          if (fileName) {
            statusManager.errorBilled({ fileName });
          }
          return;
        }
        const structs = unwrap(getStructsResult);

        const page = job.getPage(table);

        const renderRowsResult = await renderer.renderRows({
          structs,
          table,
          page,
        });
        if (!renderRowsResult.success) {
          const { reason } = unwrap(renderRowsResult);
          outputChannel.appendLine(reason);
          await renderer.cancelLoading();
          if (fileName) {
            statusManager.errorBilled({ fileName });
          }
          return;
        }
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

          const rendererOpenResult = await renderer.startLoading();
          if (!rendererOpenResult.success) {
            const { reason } = unwrap(rendererOpenResult);
            outputChannel.appendLine(reason);
            return;
          }

          const tableResult = await job.getTable();
          if (!tableResult.success) {
            const { reason } = unwrap(tableResult);
            outputChannel.appendLine(reason);
            await renderer.cancelLoading();
            return;
          }
          const { value: table } = tableResult;

          const renderTableResult = await renderer.renderTable(table);
          if (!renderTableResult.success) {
            const { reason } = unwrap(renderTableResult);
            outputChannel.appendLine(reason);
            await renderer.cancelLoading();
            return;
          }

          const getStructsResult = await job.getPrevStructs();
          if (!getStructsResult.success) {
            const { type, reason } = unwrap(getStructsResult);
            outputChannel.appendLine(reason);
            if (type === "NoPageToken") {
              await window.showErrorMessage(reason);
            }
            await renderer.cancelLoading();
            return;
          }
          const structs = unwrap(getStructsResult);

          const page = job.getPage(table);

          const renderRowsResult = await renderer.renderRows({
            structs,
            table,
            page,
          });
          if (!renderRowsResult.success) {
            const { reason } = unwrap(renderRowsResult);
            outputChannel.appendLine(reason);
            await renderer.cancelLoading();
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

          const rendererOpenResult = await renderer.startLoading();
          if (!rendererOpenResult.success) {
            const { reason } = unwrap(rendererOpenResult);
            outputChannel.appendLine(reason);
            return;
          }

          const getTableResult = await job.getTable();
          if (!getTableResult.success) {
            const { reason } = unwrap(getTableResult);
            outputChannel.appendLine(reason);
            await renderer.cancelLoading();
            return;
          }
          const { value: table } = getTableResult;

          const renderTableResult = await renderer.renderTable(table);
          if (!renderTableResult.success) {
            const { reason } = unwrap(renderTableResult);
            outputChannel.appendLine(reason);
            await renderer.cancelLoading();
            return;
          }

          const getStructsResult = await job.getNextStructs();
          if (!getStructsResult.success) {
            const { type, reason } = unwrap(getStructsResult);
            outputChannel.appendLine(reason);
            if (type === "NoPageToken") {
              await window.showErrorMessage(reason);
            }
            await renderer.cancelLoading();
            return;
          }
          const structs = unwrap(getStructsResult);

          const page = job.getPage(table);

          const renderRowsResult = await renderer.renderRows({
            structs,
            table,
            page,
          });
          if (!renderRowsResult.success) {
            const { reason } = unwrap(renderRowsResult);
            outputChannel.appendLine(reason);
            await renderer.cancelLoading();
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
