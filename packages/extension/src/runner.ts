import { basename } from "path";
import { format, parse } from "bytes";
import type { RunJob } from "core";
import { createParser, createClient } from "core";
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
} from "shared";
import { isStandaloneStatistics, unwrap, succeed } from "shared";
import type { TextEditor, ViewColumn } from "vscode";
import { checksum } from "./checksum";
import { getCompiledQuery } from "./compiler";
import type { ConfigManager } from "./configManager";
import type { ErrorManager } from "./errorManager";
import type { ErrorMarker, ErrorMarkerManager } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import type { Logger } from "./logger";
import type { ParamManager } from "./paramManager";
import type { RendererManager } from "./renderer";
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
  clearParams(): Promise<void>;
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
  paramManager,
  rendererManager,
  errorManager,
  errorMarkerManager,
}: Readonly<{
  logger: Logger;
  configManager: ConfigManager;
  statusManager: StatusManager;
  paramManager: ParamManager;
  rendererManager: RendererManager;
  errorManager: ErrorManager;
  errorMarkerManager: ErrorMarkerManager;
}>) {
  const runners = new Map<RunnerID, Runner>();

  const parser = createParser();

  const createRunner = async ({
    runnerId,
    logger,
    query,
    title,
    baseViewColumn,
    status,
    errorMarker,
  }: Readonly<{
    runnerId: RunnerID;
    logger: Logger;
    query: string;
    title: string;
    baseViewColumn?: ViewColumn;
    status: Status;
    errorMarker?: ErrorMarker;
  }>): Promise<
    Result<Err<"Unknown" | "NoJob" | "Query" | "QueryWithPosition">, Runner>
  > => {
    let pageable:
      | {
          job: RunJob;
          table: Table;
        }
      | undefined;
    const paramValuesManager = paramManager.create({ runnerId });

    return succeed({
      query,

      async run() {
        logger.log(`run`);

        status.loadBilled();

        const config = configManager.get();

        const clientResult = await createClient({
          keyFilename: config.keyFilename,
          projectId: config.projectId,
          location: config.location,
        });
        if (!clientResult.success) {
          logger.error(clientResult);
          status.errorBilled();
          const err = unwrap(clientResult);
          errorManager.show(err);
          return;
        }
        const client = unwrap(clientResult);

        const tokens = parser.parse(query);
        const paramsResult = await paramValuesManager.get(tokens);
        if (!paramsResult.success) {
          logger.error(paramsResult);
          status.errorBilled();
          const err = unwrap(paramsResult);
          errorManager.show(err);
          return;
        }
        const params = paramsResult.value;

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

          errorManager.show(err);
          return;
        }
        errorMarker?.clear();

        const getRendererResult = await rendererManager.create({
          runnerId,
          title,
          baseViewColumn,
        });
        if (!getRendererResult.success) {
          logger.error(getRendererResult);
          errorManager.show(getRendererResult.value);
          status.errorBilled();
          return;
        }
        const renderer = unwrap(getRendererResult);

        const rendererOpenResult = await renderer.startProcessing();
        if (!rendererOpenResult.success) {
          logger.error(rendererOpenResult);
          await renderer.failProcessing(rendererOpenResult.value);
          status.errorBilled();
          return;
        }

        renderer.reveal();

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

        const getRendererResult = await rendererManager.create({
          runnerId,
          title,
          baseViewColumn,
        });
        if (!getRendererResult.success) {
          logger.error(getRendererResult);
          errorManager.show(getRendererResult.value);
          status.errorBilled();
          return;
        }
        const renderer = unwrap(getRendererResult);

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
        const getRendererResult = await rendererManager.create({
          runnerId,
          title,
          baseViewColumn,
        });
        if (!getRendererResult.success) {
          logger.error(getRendererResult);
          errorManager.show(getRendererResult.value);
          status.errorBilled();
          return;
        }
        const renderer = unwrap(getRendererResult);
        await renderer.moveTabFocus(diff);
      },

      async focusOnTab(tab) {
        const getRendererResult = await rendererManager.create({
          runnerId,
          title,
          baseViewColumn,
        });
        if (!getRendererResult.success) {
          logger.error(getRendererResult);
          errorManager.show(getRendererResult.value);
          status.errorBilled();
          return;
        }
        const renderer = unwrap(getRendererResult);
        await renderer.focusOnTab(tab);
      },

      async clearParams() {
        const manager = paramManager.get({ runnerId });
        if (!manager) {
          return;
        }
        await manager.clearParams();
      },

      async dispose() {
        const renderer = rendererManager.get({ runnerId });
        if (!renderer || renderer.disposed) {
          return;
        }
        runners.delete(runnerId);
      },
    });
  };

  return {
    async getWithEditor(
      editor: TextEditor
    ): Promise<
      Result<
        Err<"Unknown" | "NoText" | "Query" | "QueryWithPosition" | "NoJob">,
        Runner
      >
    > {
      const {
        document: { fileName },
        viewColumn,
      } = editor;

      const queryTextResult = await getQueryText(editor);
      if (!queryTextResult.success) {
        return queryTextResult;
      }
      const config = configManager.get();

      const query = queryTextResult.value;
      const compiledQuery = await getCompiledQuery(query, config.libsRoot);
      const didCompilerRun = query.localeCompare(compiledQuery) !== 0;

      const runnerId: RunnerID = `file://${fileName}`;
      const logger = parentLogger.createChild(runnerId);
      const title = basename(fileName);

      const status = statusManager.get(runnerId);
      const errorMarker = errorMarkerManager.get({
        runnerId,
        editor,
      });

      const createResult = await createRunner({
        runnerId,
        logger,
        query: compiledQuery,
        title,
        baseViewColumn: viewColumn,
        status,
        errorMarker: didCompilerRun ? undefined : errorMarker,
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

      const status = statusManager.get(runnerId);

      const config = configManager.get();
      const compiledQuery = await getCompiledQuery(query, config.libsRoot);

      const createResult = await createRunner({
        runnerId,
        logger,
        query: compiledQuery,
        title,
        baseViewColumn: viewColumn,
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
}
