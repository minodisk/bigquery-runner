import { basename } from "path";
import { format } from "bytes";
import { createClient, parse, RunJob } from "core";
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
  Format,
  formats,
} from "types";
import { TextEditor, ViewColumn, window, workspace } from "vscode";
import { checksum } from "./checksum";
import { ConfigManager } from "./configManager";
import { Downloader } from "./downloader";
import { ErrorMarker, ErrorMarkerManager } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import { Logger } from "./logger";
import { Renderer, RendererManager } from "./renderer";
import { Status, StatusManager } from "./statusManager";

export type RunnerManager = ReturnType<typeof createRunnerManager>;
export type RunJobResponse = SelectResponse | RoutineResponse;
export type Runner = Readonly<{
  run(): Promise<void>;
  prev(): Promise<void>;
  next(): Promise<void>;
  download(format: Format): Promise<void>;
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
  logger: parentLogger,
  configManager,
  statusManager,
  rendererManager,
  downloader,
  errorMarkerManager,
}: Readonly<{
  logger: Logger;
  configManager: ConfigManager;
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
        document: { fileName },
        viewColumn,
      } = editor;

      const runnerId: RunnerID = `file://${fileName}`;
      const logger = parentLogger.createChild(runnerId);
      const title = basename(fileName);
      const query = await getQueryText(editor);

      const getRendererResult = await rendererManager.get({
        runnerId,
        title,
        viewColumn,
      });
      if (!getRendererResult.success) {
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
        logger,
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
      const logger = parentLogger.createChild(runnerId);

      const getRendererResult = await rendererManager.get({
        runnerId,
        title,
        viewColumn,
      });
      if (!getRendererResult.success) {
        return getRendererResult;
      }
      const renderer = unwrap(getRendererResult);

      const status = statusManager.get(runnerId);

      const createResult = await createRunner({
        runnerId,
        logger,
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
    logger,
    query,
    renderer,
    status,
    errorMarker,
  }: Readonly<{
    runnerId: RunnerID;
    logger: Logger;
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
    let job: RunJob | undefined;

    const runner: Runner = {
      async run() {
        logger.log(`run`);

        renderer.reveal();
        status.loadBilled();

        const rendererOpenResult = await renderer.startLoading();
        if (!rendererOpenResult.success) {
          logger.error(rendererOpenResult);
          await renderer.cancelLoading();
          status.errorBilled();
          return;
        }

        const config = configManager.get();

        const parseResult = parse(query);
        const namedParams: { [name: string]: number | string } = {};
        const positionalParams: Array<number | string> = [];
        if (!parseResult.success) {
          logger.error(parseResult);
        } else {
          const { params } = unwrap(parseResult);
          const paramsResult = params();
          if (!paramsResult.success) {
            logger.error(paramsResult);
          } else {
            const { names, positions } = unwrap(paramsResult);
            if (names.length > 0) {
              for (const name of names) {
                const value = await window.showInputBox({
                  title: `@${name}`,
                  prompt: `Enter the value for '@${name}'`,
                });
                if (value === undefined) {
                  continue;
                }
                namedParams[name] = isNaN(Number(value))
                  ? value
                  : Number(value);
              }
            } else if (positions > 0) {
              for (let i = 0; i < positions; i++) {
                const value = await window.showInputBox({
                  title: `?[${i}]`,
                  prompt: `Enter the value for '?[${i}]'`,
                });
                if (value === undefined) {
                  continue;
                }
                positionalParams[i] = isNaN(Number(value))
                  ? value
                  : Number(value);
              }
            }
          }
        }

        const clientResult = await createClient(config);
        if (!clientResult.success) {
          logger.error(clientResult);
          const { reason } = unwrap(clientResult);
          await window.showErrorMessage(reason);
          await renderer.cancelLoading();
          status.errorBilled();
          return;
        }
        const client = unwrap(clientResult);

        const runJobResult = await client.createRunJob({
          query,
          maxResults: config.viewer.rowsPerPage,
          params:
            Object.keys(namedParams).length > 0
              ? namedParams
              : positionalParams.length > 0
              ? positionalParams
              : undefined,
        });
        errorMarker?.clear();
        if (!runJobResult.success) {
          const err = unwrap(runJobResult);
          logger.log(err.reason);
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

        logger.log(`job ID: ${job.id}`);

        const bytes = format(parseInt(totalBytesBilled, 10));
        logger.log(`result: ${bytes} to be billed (cache: ${cacheHit})`);
        status.succeedBilled({
          bytes,
          cacheHit: metadata.statistics.query.cacheHit,
        });

        const renderMetadataResult = await renderer.renderMetadata(metadata);
        if (!renderMetadataResult.success) {
          logger.error(renderMetadataResult);
          await renderer.cancelLoading();
          return;
        }

        if (
          !metadata.configuration.query.destinationTable &&
          numChildJobs &&
          ["SCRIPT"].some((type) => statementType === type)
        ) {
          // Wait for completion of table creation job
          // to get the records of the table just created.
          const routineResult = await job.getRoutine();
          if (!routineResult.success) {
            logger.error(routineResult);
            await renderer.cancelLoading();
            return;
          }
          const routine = unwrap(routineResult);

          const renderRoutineResult = await renderer.renderRoutine(routine);
          if (!renderRoutineResult.success) {
            logger.error(renderRoutineResult);
            await renderer.cancelLoading();
            return;
          }

          return;
        }

        const getTableResult = await job.getTable();
        if (!getTableResult.success) {
          logger.error(getTableResult);
          await renderer.cancelLoading();
          return;
        }
        const table = unwrap(getTableResult);

        const renderTableResult = await renderer.renderTable(table);
        if (!renderTableResult.success) {
          logger.error(renderTableResult);
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
          logger.error(getStructsResult);
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
          logger.error(renderRowsResult);
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
          logger.error(rendererOpenResult);
          return;
        }

        const tableResult = await job.getTable();
        if (!tableResult.success) {
          const { reason } = unwrap(tableResult);
          logger.log(reason);
          await renderer.cancelLoading();
          return;
        }
        const { value: table } = tableResult;

        const renderTableResult = await renderer.renderTable(table);
        if (!renderTableResult.success) {
          logger.error(renderTableResult);
          await renderer.cancelLoading();
          return;
        }

        const getStructsResult = await job.getPrevStructs();
        if (!getStructsResult.success) {
          logger.error(getStructsResult);
          const { type, reason } = unwrap(getStructsResult);
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
          logger.error(renderRowsResult);
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
          logger.error(rendererOpenResult);
          return;
        }

        const getTableResult = await job.getTable();
        if (!getTableResult.success) {
          logger.error(getTableResult);
          await renderer.cancelLoading();
          return;
        }
        const { value: table } = getTableResult;

        const renderTableResult = await renderer.renderTable(table);
        if (!renderTableResult.success) {
          logger.error(renderTableResult);
          await renderer.cancelLoading();
          return;
        }

        const getStructsResult = await job.getNextStructs();
        if (!getStructsResult.success) {
          logger.error(getStructsResult);
          const { type, reason } = unwrap(getStructsResult);
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
          logger.error(renderRowsResult);
          await renderer.cancelLoading();
          return;
        }
      },

      async download(format) {
        const name = formats[format];
        const uri = await window.showSaveDialog({
          defaultUri:
            workspace.workspaceFolders &&
            workspace.workspaceFolders[0] &&
            workspace.workspaceFolders[0].uri,
          filters: {
            [name]: [format],
          },
        });
        if (!uri) {
          return;
        }

        switch (format) {
          case "jsonl":
            return downloader.jsonl({ uri, query });
          case "json":
            return downloader.json({ uri, query });
          case "csv":
            return downloader.csv({ uri, query });
          case "md":
            return downloader.markdown({ uri, query });
          case "txt":
            return downloader.text({ uri, query });
        }
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
