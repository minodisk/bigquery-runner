import { basename } from "path";
import { format } from "bytes";
import { createClient, Parameter, parse, RunJob } from "core";
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
  tryCatchSync,
  errorToString,
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

        const rendererOpenResult = await renderer.startProcessing();
        if (!rendererOpenResult.success) {
          logger.error(rendererOpenResult);
          await renderer.failProcessing(rendererOpenResult.value);
          status.errorBilled();
          return;
        }

        const config = configManager.get();

        const getParamValuesResult = await getParamValues(parse(query));
        if (!getParamValuesResult.success) {
          logger.error(getParamValuesResult);
          await renderer.failProcessing(getParamValuesResult.value);
          status.errorBilled();
          return;
        }
        const params = getParamValuesResult.value;

        const clientResult = await createClient(config);
        if (!clientResult.success) {
          logger.error(clientResult);
          const { reason } = unwrap(clientResult);
          await window.showErrorMessage(reason);
          await renderer.failProcessing(clientResult.value);
          status.errorBilled();
          return;
        }
        const client = unwrap(clientResult);

        const runJobResult = await client.createRunJob({
          query,
          maxResults: config.viewer.rowsPerPage,
          params,
        });
        errorMarker?.clear();
        if (!runJobResult.success) {
          const err = unwrap(runJobResult);
          logger.log(err.reason);
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
          await renderer.failProcessing(renderMetadataResult.value);
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
            await renderer.failProcessing(routineResult.value);
            return;
          }
          const routine = unwrap(routineResult);

          const renderRoutineResult = await renderer.renderRoutine(routine);
          if (!renderRoutineResult.success) {
            logger.error(renderRoutineResult);
            await renderer.failProcessing(renderRoutineResult.value);
            return;
          }

          await renderer.successProcessing();
          return;
        }

        const getTableResult = await job.getTable();
        if (!getTableResult.success) {
          logger.error(getTableResult);
          await renderer.failProcessing(getTableResult.value);
          return;
        }
        const table = unwrap(getTableResult);

        const renderTableResult = await renderer.renderTable(table);
        if (!renderTableResult.success) {
          logger.error(renderTableResult);
          await renderer.failProcessing(renderTableResult.value);
          return;
        }

        if (
          // There is no row in query result.
          ["CREATE_TABLE_AS_SELECT", "MERGE"].some(
            (type) => statementType === type
          )
        ) {
          await renderer.successProcessing();
          return;
        }

        const getStructsResult = await job.getStructs();
        if (!getStructsResult.success) {
          logger.error(getStructsResult);
          await renderer.failProcessing(getStructsResult.value);
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
          await renderer.failProcessing(renderRowsResult.value);
          return;
        }

        await renderer.successProcessing();
      },

      async prev() {
        if (!job) {
          return;
        }

        renderer.reveal();

        const rendererOpenResult = await renderer.startProcessing();
        if (!rendererOpenResult.success) {
          logger.error(rendererOpenResult);
          return;
        }

        const tableResult = await job.getTable();
        if (!tableResult.success) {
          const { reason } = unwrap(tableResult);
          logger.log(reason);
          await renderer.failProcessing(tableResult.value);
          return;
        }
        const { value: table } = tableResult;

        const renderTableResult = await renderer.renderTable(table);
        if (!renderTableResult.success) {
          logger.error(renderTableResult);
          await renderer.failProcessing(renderTableResult.value);
          return;
        }

        const getStructsResult = await job.getPrevStructs();
        if (!getStructsResult.success) {
          logger.error(getStructsResult);
          const { type, reason } = unwrap(getStructsResult);
          if (type === "NoPageToken") {
            await window.showErrorMessage(reason);
          }
          await renderer.failProcessing(getStructsResult.value);
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
          await renderer.failProcessing(renderRowsResult.value);
          return;
        }
      },

      async next() {
        if (!job) {
          return;
        }

        renderer.reveal();

        const rendererOpenResult = await renderer.startProcessing();
        if (!rendererOpenResult.success) {
          logger.error(rendererOpenResult);
          return;
        }

        const getTableResult = await job.getTable();
        if (!getTableResult.success) {
          logger.error(getTableResult);
          await renderer.failProcessing(getTableResult.value);
          return;
        }
        const { value: table } = getTableResult;

        const renderTableResult = await renderer.renderTable(table);
        if (!renderTableResult.success) {
          logger.error(renderTableResult);
          await renderer.failProcessing(renderTableResult.value);
          return;
        }

        const getStructsResult = await job.getNextStructs();
        if (!getStructsResult.success) {
          logger.error(getStructsResult);
          const { type, reason } = unwrap(getStructsResult);
          if (type === "NoPageToken") {
            await window.showErrorMessage(reason);
          }
          await renderer.failProcessing(getStructsResult.value);
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
          await renderer.failProcessing(renderRowsResult.value);
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

type ParamValues = NamedParamValues | PositionalParamValues;
type NamedParamValues = { [name: string]: unknown };
type PositionalParamValues = Array<unknown>;

const getParamValues = async (
  params: ReadonlyArray<Parameter>
): Promise<Result<Error<"InvalidJSON">, ParamValues | undefined>> => {
  const namedParams: NamedParamValues = {};
  const positionalParams: PositionalParamValues = [];

  for (const param of params) {
    switch (param.type) {
      case "named": {
        const value = await window.showInputBox({
          title: `Set parameter ${param.token}`,
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
        break;
      }
      case "positional": {
        const value = await window.showInputBox({
          title: `${param.token}[${param.index}]`,
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
        break;
      }
    }
  }

  return succeed(
    Object.keys(namedParams).length > 0
      ? namedParams
      : positionalParams.length > 0
      ? positionalParams
      : undefined
  );
};

const parseJSON = (value: string): Result<Error<"InvalidJSON">, unknown> => {
  return tryCatchSync(
    () => JSON.parse(value),
    (err) => ({
      type: "InvalidJSON",
      reason: errorToString(err),
    })
  );
};
