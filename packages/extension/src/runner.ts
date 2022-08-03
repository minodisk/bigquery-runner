import { basename } from "path";
import { format, parse } from "bytes";
import type { Parameters, RunJob } from "core";
import { createClient, parameters } from "core";
import type {
  Metadata,
  Page,
  Routine,
  StructuralRow,
  Table,
  RunnerID,
  Result,
  Err,
  Tab,
  ParamValues,
  NamedParamValues,
  PositionalParamValues,
} from "shared";
import {
  isStandaloneStatistics,
  unwrap,
  succeed,
  tryCatchSync,
  errorToString,
} from "shared";
import type { TextEditor, ViewColumn } from "vscode";
import { window } from "vscode";
import { checksum } from "./checksum";
import type { ConfigManager } from "./configManager";
import type { ErrorMarker, ErrorMarkerManager } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import type { Logger } from "./logger";
import type { Renderer, RendererManager } from "./renderer";
import type { Status, StatusManager } from "./statusManager";
import { showError } from "./window";

export type RunnerManager = ReturnType<typeof createRunnerManager>;
export type RunJobResponse = SelectResponse | RoutineResponse;
export type Runner = Readonly<{
  query: string;
  run(): Promise<void>;
  movePage(diff: number): Promise<void>;
  moveFocusTab(diff: number): Promise<void>;
  focusOnTab(tab: Tab): Promise<void>;
  dispose(): void;
}>;

export type SelectResponse = Readonly<{
  structs: Array<StructuralRow>;
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
  errorMarkerManager,
}: Readonly<{
  logger: Logger;
  configManager: ConfigManager;
  statusManager: StatusManager;
  rendererManager: RendererManager;
  errorMarkerManager: ErrorMarkerManager;
}>) {
  const runners = new Map<RunnerID, Runner>();

  const runnerManager = {
    async getWithEditor(
      editor: TextEditor
    ): Promise<
      Result<
        Err<
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
      viewColumn?: ViewColumn;
    }>): Promise<
      Result<
        Err<
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
      Err<
        "Unknown" | "Authentication" | "NoJob" | "Query" | "QueryWithPosition"
      >,
      Runner
    >
  > => {
    let pageable:
      | {
          job: RunJob;
          table: Table;
        }
      | undefined;

    const runner: Runner = {
      query,

      async run() {
        logger.log(`run`);

        renderer.reveal();
        status.loadBilled();

        const rendererOpenResult = await renderer.startProcessing();
        if (!rendererOpenResult.success) {
          logger.error(rendererOpenResult);
          await renderer.failProcessing(rendererOpenResult.value);
          status.errorBilled();
          return;
        }

        const config = configManager.get();

        const getParamValuesResult = await getParamValues(parameters(query));
        if (!getParamValuesResult.success) {
          logger.error(getParamValuesResult);
          await renderer.failProcessing(getParamValuesResult.value);
          status.errorBilled();
          return;
        }
        const params = getParamValuesResult.value;

        const clientResult = await createClient({
          keyFilename: config.keyFilename,
          projectId: config.projectId,
          location: config.location,
        });
        if (!clientResult.success) {
          logger.error(clientResult);
          const { reason } = unwrap(clientResult);
          showError(reason);
          await renderer.failProcessing(clientResult.value);
          status.errorBilled();
          return;
        }
        const client = unwrap(clientResult);

        const runJobResult = await client.createRunJob({
          query,
          useLegacySql: config.useLegacySql,
          maximumBytesBilled: config.maximumBytesBilled
            ? parse(config.maximumBytesBilled).toString()
            : undefined,
          defaultDataset: config.defaultDataset,
          maxResults: config.viewer.rowsPerPage,
          params,
        });
        errorMarker?.clear();
        if (!runJobResult.success) {
          logger.error(runJobResult);
          const err = unwrap(runJobResult);
          await renderer.failProcessing(runJobResult.value);
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
          showError(err.reason);
          return;
        }
        errorMarker?.clear();

        const job = unwrap(runJobResult);

        const { metadata } = job;
        const { statistics } = metadata;

        const bytes = format(parseInt(statistics.query.totalBytesBilled, 10));
        const cacheHit = isStandaloneStatistics(statistics)
          ? statistics.query.cacheHit
          : false;
        logger.log(`result: ${bytes} to be billed (cache: ${cacheHit})`);
        status.succeedBilled({
          bytes,
          cacheHit,
        });

        const renderMetadataResult = await renderer.renderMetadata(metadata);
        if (!renderMetadataResult.success) {
          logger.error(renderMetadataResult);
          await renderer.failProcessing(renderMetadataResult.value);
          return;
        }

        const getTableResult = await job.getTable();
        if (!getTableResult.success) {
          const error = getTableResult.value;
          if (error.type === "NoDestinationTable") {
            //----- child jobs
            const getChildrenResult = await job.getChildren();
            if (!getChildrenResult.success) {
              logger.error(getChildrenResult);
              await renderer.failProcessing(getChildrenResult.value);
              return;
            }
            const { tables, routines } = unwrap(getChildrenResult);

            {
              const result = await renderer.renderTables(tables);
              if (!result.success) {
                logger.error(result);
                await renderer.failProcessing(result.value);
                return;
              }
            }

            {
              const result = await renderer.renderRoutines(routines);
              if (!result.success) {
                logger.error(result);
                await renderer.failProcessing(result.value);
                return;
              }
            }

            await renderer.successProcessing();
            return;
          }

          logger.error(getTableResult);
          await renderer.failProcessing(getTableResult.value);
          return;
        }
        const table = unwrap(getTableResult);

        const renderTableResult = await renderer.renderTables([table]);
        if (!renderTableResult.success) {
          logger.error(renderTableResult);
          await renderer.failProcessing(renderTableResult.value);
          return;
        }

        const getStructuralRowsResult = await job.getStructuralRows();
        if (!getStructuralRowsResult.success) {
          const error = getStructuralRowsResult.value;
          if (error.type === "NoRows") {
            //----- CREATE TABLE
            //----- MERGE
            await renderer.successProcessing();
            return;
          }

          logger.error(getStructuralRowsResult);
          await renderer.failProcessing(getStructuralRowsResult.value);
          return;
        }
        const { structs, page } = unwrap(getStructuralRowsResult);
        logger.log(
          `fetched: ${page.startRowNumber} - ${page.endRowNumber} (${page.totalRows} rows)`
        );

        const renderRowsResult = await renderer.renderRows({
          structs,
          table,
          page,
        });
        if (!renderRowsResult.success) {
          logger.error(renderRowsResult);
          await renderer.failProcessing(renderRowsResult.value);
          return;
        }

        //----- SELECT
        pageable = { job, table };
        await renderer.successProcessing();
      },

      async movePage(diff) {
        if (!pageable) {
          return;
        }

        const { job, table } = pageable;

        renderer.reveal();

        const rendererOpenResult = await renderer.startProcessing();
        if (!rendererOpenResult.success) {
          logger.error(rendererOpenResult);
          return;
        }

        const getStructsResult = await job.getPagingStructuralRows(diff);
        if (!getStructsResult.success) {
          const { type, reason } = unwrap(getStructsResult);
          if (type === "NoPageToken") {
            showError(reason);
          }
          await renderer.failProcessing(getStructsResult.value);
          return;
        }
        const { structs, page } = unwrap(getStructsResult);
        logger.log(
          `fetched: ${page.startRowNumber} - ${page.endRowNumber} (${page.totalRows} rows)`
        );

        const renderRowsResult = await renderer.renderRows({
          structs,
          table,
          page,
        });
        if (!renderRowsResult.success) {
          logger.error(renderRowsResult);
          await renderer.failProcessing(renderRowsResult.value);
          return;
        }

        await renderer.successProcessing();
      },

      async moveFocusTab(diff) {
        await renderer.moveTabFocus(diff);
      },

      async focusOnTab(tab) {
        await renderer.focusOnTab(tab);
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

const getParamValues = async ({
  named,
  positional,
}: Parameters): Promise<
  Result<Err<"InvalidJSON">, ParamValues | undefined>
> => {
  if (named.length > 0) {
    const namedParams: NamedParamValues = {};
    for (const param of named) {
      const value = await window.showInputBox({
        title: `Set a parameter to ${param.token}`,
        prompt: `Specify in JSON format`,
      });
      if (value === undefined) {
        continue;
      }
      const parseJSONResult = parseJSON(value);
      if (!parseJSONResult.success) {
        return parseJSONResult;
      }
      namedParams[param.name] = parseJSONResult.value;
    }
    return succeed(namedParams);
  }

  if (positional.length > 0) {
    const positionalParams: PositionalParamValues = [];
    for (const param of positional) {
      const value = await window.showInputBox({
        title: `Set a parameter for the ${param.index}-th ${param.token}`,
        prompt: `Specify in JSON format`,
      });
      if (value === undefined) {
        continue;
      }
      const parseJSONResult = parseJSON(value);
      if (!parseJSONResult.success) {
        return parseJSONResult;
      }
      positionalParams[param.index] = parseJSONResult.value;
    }
    return succeed(positionalParams);
  }

  return succeed(undefined);
};

const parseJSON = (value: string): Result<Err<"InvalidJSON">, unknown> => {
  return tryCatchSync(
    () => JSON.parse(value),
    (err) => ({
      type: "InvalidJSON",
      reason: errorToString(err),
    })
  );
};
