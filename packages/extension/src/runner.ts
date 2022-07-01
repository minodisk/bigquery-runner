import { basename } from "path";
import { format } from "bytes";
import { createClient, RunJob } from "core";
import {
  Metadata,
  Page,
  Routine,
  Struct,
  Table,
  unwrap,
  RunnerID,
  succeed,
  Result,
  type Error,
} from "types";
import {
  OutputChannel,
  TextEditor,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import { checksum } from "./checksum";
import { ConfigManager } from "./configManager";
import { Downloader } from "./downloader";
import { ErrorMarker, ErrorMarkerManager } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import { Renderer, RendererManager } from "./renderer";
import { Status, StatusManager } from "./statusManager";

export type RunnerManager = ReturnType<typeof createRunnerManager>;
export type RunJobResponse = SelectResponse | RoutineResponse;
export type Runner = Readonly<{
  run(): Promise<void>;
  prev(): Promise<void>;
  next(): Promise<void>;
  download(): Promise<void>;
  preview(): Promise<void>;
  dispose(): void;
}>;

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
  errorMarkerManager,
}: Readonly<{
  configManager: ConfigManager;
  outputChannel: OutputChannel;
  statusManager: StatusManager;
  rendererManager: RendererManager;
  downloader: Downloader;
  errorMarkerManager: ErrorMarkerManager;
}>) {
  const runners = new Map<RunnerID, Runner>();

  const runnerManager = {
    async getWithEditor(
      editor: TextEditor
    ): Promise<
      Result<
        Error<
          "Unknown" | "Authentication" | "Query" | "QueryWithPosition" | "NoJob"
        >,
        Runner
      >
    > {
      const {
        document: { fileName, version },
        viewColumn,
      } = editor;

      const runnerId: RunnerID = `file://${fileName}`;

      const title = `${basename(fileName)}[${version}]`;
      const query = await getQueryText(editor);

      const getRendererResult = await rendererManager.get({
        runnerId,
        title,
        viewColumn,
      });
      if (!getRendererResult.success) {
        const { reason } = unwrap(getRendererResult);
        outputChannel.appendLine(reason);
        return getRendererResult;
      }
      const renderer = unwrap(getRendererResult);

      const status = statusManager.get(runnerId);
      const errorMarker = errorMarkerManager.get({
        runnerId,
        editor,
      });

      const createResult = await createRunner({
        runnerId,
        query,
        renderer,
        status,
        errorMarker,
      });
      if (!createResult.success) {
        return createResult;
      }
      const runner = unwrap(createResult);

      runners.set(runnerId, runner);
      return createResult;
    },

    async getWithQuery({
      title,
      query,
      viewColumn,
    }: Readonly<{
      title: string;
      query: string;
      viewColumn: ViewColumn;
    }>): Promise<
      Result<
        Error<
          "Unknown" | "Authentication" | "Query" | "QueryWithPosition" | "NoJob"
        >,
        Runner
      >
    > {
      const runnerId: RunnerID = `query://${checksum(query)}`;

      const getRendererResult = await rendererManager.get({
        runnerId,
        title,
        viewColumn,
      });
      if (!getRendererResult.success) {
        const { reason } = unwrap(getRendererResult);
        outputChannel.appendLine(reason);
        return getRendererResult;
      }
      const renderer = unwrap(getRendererResult);

      const status = statusManager.get(runnerId);

      const createResult = await createRunner({
        runnerId,
        query,
        renderer,
        status,
      });
      if (!createResult.success) {
        return createResult;
      }
      const runner = unwrap(createResult);

      runners.set(runnerId, runner);
      return createResult;
    },

    get(runnerId: RunnerID) {
      return runners.get(runnerId);
    },

    findWithFileName(fileName: string) {
      const runnerId: RunnerID = `file://${fileName}`;
      return runners.get(runnerId);
    },

    dispose() {
      runners.clear();
    },
  };

  const createRunner = async ({
    runnerId,
    query,
    renderer,
    status,
    errorMarker,
  }: Readonly<{
    runnerId: RunnerID;
    query: string;
    renderer: Renderer;
    status: Status;
    errorMarker?: ErrorMarker;
  }>): Promise<
    Result<
      Error<
        "Unknown" | "Authentication" | "NoJob" | "Query" | "QueryWithPosition"
      >,
      Runner
    >
  > => {
    outputChannel.appendLine(`Run`);
    let job: RunJob | undefined;

    const runner: Runner = {
      async run() {
        renderer.reveal();
        status.loadBilled();

        const rendererOpenResult = await renderer.startLoading();
        if (!rendererOpenResult.success) {
          const { reason } = unwrap(rendererOpenResult);
          outputChannel.appendLine(reason);
          await renderer.cancelLoading();
          status.errorBilled();
          return;
        }

        const config = configManager.get();

        const clientResult = await createClient(config);
        if (!clientResult.success) {
          const { reason } = unwrap(clientResult);
          outputChannel.appendLine(reason);
          await window.showErrorMessage(reason);
          await renderer.cancelLoading();
          status.errorBilled();
          return;
        }
        const client = unwrap(clientResult);

        const runJobResult = await client.createRunJob({
          query,
          maxResults: config.pagination.results,
        });
        errorMarker?.clear();
        if (!runJobResult.success) {
          const err = unwrap(runJobResult);
          outputChannel.appendLine(err.reason);
          await renderer.cancelLoading();
          status.errorBilled();
          if (errorMarker) {
            if (err.type === "QueryWithPosition") {
              errorMarker.markAt({
                reason: err.reason,
                position: err.position,
              });
              return;
            }
            if (err.type === "Query") {
              errorMarker.markAll({
                reason: err.reason,
              });
              return;
            }
          }
          await window.showErrorMessage(err.reason);
          return;
        }
        errorMarker?.clear();

        job = unwrap(runJobResult);

        const { metadata, statementType } = job;
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
        status.succeedBilled({
          bytes,
          cacheHit: metadata.statistics.query.cacheHit,
        });

        const renderMedatadaResult = await renderer.renderMetadata(metadata);
        if (!renderMedatadaResult.success) {
          const { reason } = unwrap(renderMedatadaResult);
          outputChannel.appendLine(reason);
          await renderer.cancelLoading();
          return;
        }

        if (numChildJobs && ["SCRIPT"].some((type) => statementType === type)) {
          // Wait for completion of table creation job
          // to get the records of the table just created.
          const routineResult = await job.getRoutine();
          if (!routineResult.success) {
            const { reason } = unwrap(routineResult);
            outputChannel.appendLine(reason);
            await renderer.cancelLoading();
            return;
          }
          const routine = unwrap(routineResult);

          const renderRoutineResult = await renderer.renderRoutine(routine);
          if (!renderRoutineResult.success) {
            const { reason } = unwrap(renderRoutineResult);
            outputChannel.appendLine(reason);
            await renderer.cancelLoading();
            return;
          }

          return;
        }

        const getTableResult = await job.getTable();
        if (!getTableResult.success) {
          const { reason } = unwrap(getTableResult);
          outputChannel.appendLine(reason);
          await renderer.cancelLoading();
          return;
        }
        const table = unwrap(getTableResult);

        const renderTableResult = await renderer.renderTable(table);
        if (!renderTableResult.success) {
          const { reason } = unwrap(renderTableResult);
          outputChannel.appendLine(reason);
          await renderer.cancelLoading();
          return;
        }

        if (
          // There is no row in query result.
          ["CREATE_TABLE_AS_SELECT", "MERGE"].some(
            (type) => statementType === type
          )
        ) {
          return;
        }

        const getStructsResult = await job.getStructs();
        if (!getStructsResult.success) {
          const { reason } = unwrap(getStructsResult);
          outputChannel.appendLine(reason);
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

      async prev() {
        if (!job) {
          return;
        }

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
        if (!job) {
          return;
        }

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

        await downloader.jsonl({ uri, query });
      },

      async preview() {
        if (!job) {
          return;
        }

        if (!job.tableName) {
          throw new Error(`preview is failed: table name is not defined`);
        }
        const query = `SELECT * FROM ${job.tableName}`;

        const runnerResult = await runnerManager.getWithQuery({
          title: job.tableName,
          query,
          viewColumn: renderer.viewColumn,
        });
        if (!runnerResult.success) {
          return;
        }
        const runner = unwrap(runnerResult);

        await runner.run();
      },

      dispose() {
        if (!renderer.disposed) {
          return;
        }
        runners.delete(runnerId);
      },
    };

    return succeed(runner);
  };

  return runnerManager;
}
