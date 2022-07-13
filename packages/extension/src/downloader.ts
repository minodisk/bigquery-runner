import { createWriteStream } from "fs";
import type { Formatter } from "core";
import {
  createClient,
  createCSVFormatter,
  createFlat,
  createJSONFormatter,
  createJSONLinesFormatter,
  createMarkdownFormatter,
  createTableFormatter,
} from "core";
import { errorToString, tryCatchSync, unwrap } from "types";
import type { Uri } from "vscode";
import type { Config } from "./config";
import type { ConfigManager } from "./configManager";
import type { Logger } from "./logger";

export type Downloader = ReturnType<typeof createDownloader>;

export function createDownloader({
  logger: parentLogger,
  configManager,
}: Readonly<{
  logger: Logger;
  configManager: ConfigManager;
}>) {
  return {
    jsonl: createWriter({
      configManager,
      logger: parentLogger.createChild("jsonl"),
      createFormatter: (params) => createJSONLinesFormatter(params),
    }),
    json: createWriter({
      configManager,
      logger: parentLogger.createChild("json"),
      createFormatter: (params) => createJSONFormatter(params),
    }),
    csv: createWriter({
      configManager,
      logger: parentLogger.createChild("csv"),
      createFormatter: ({
        writer,
        config,
      }: {
        writer: NodeJS.WritableStream;
        config: Config;
      }) =>
        createCSVFormatter({
          writer,
          options: config.downloader.csv,
        }),
    }),
    markdown: createWriter({
      configManager,
      logger: parentLogger.createChild("markdown"),
      createFormatter: (params) => createMarkdownFormatter(params),
    }),
    text: createWriter({
      configManager,
      logger: parentLogger.createChild("text"),
      createFormatter: (params) => createTableFormatter(params),
    }),
    dispose() {
      // do nothing
    },
  };
}

const createWriter =
  ({
    configManager,
    logger,
    createFormatter,
  }: {
    configManager: ConfigManager;
    logger: Logger;
    createFormatter: (params: {
      writer: NodeJS.WritableStream;
      config: Config;
    }) => Formatter;
  }) =>
  async ({ uri, query }: { uri: Uri; query: string }) => {
    logger.log(`start downloading to ${uri.path}`);

    const config = configManager.get();

    const createClientResult = await createClient(config);
    if (!createClientResult.success) {
      logger.error(createClientResult);
      return;
    }
    const client = unwrap(createClientResult);

    const createRunJobResult = await client.createRunJob({
      query,
      maxResults: config.downloader.rowsPerPage,
    });
    if (!createRunJobResult.success) {
      logger.error(createRunJobResult);
      return;
    }
    const job = unwrap(createRunJobResult);
    logger.log(`job created ${job.id}`);

    const getTableResult = await job.getTable();
    if (!getTableResult.success) {
      logger.error(getTableResult);
      return;
    }
    const table = unwrap(getTableResult);
    logger.log(`table fetched ${table.id}`);
    if (!table.schema.fields) {
      logger.error("no schema");
      return;
    }

    const flatResult = createFlat(table.schema.fields);
    if (!flatResult.success) {
      logger.error(flatResult);
      return;
    }
    const flat = unwrap(flatResult);
    logger.log(`flat created ${flat.heads.map(({ name }) => name).join(", ")}`);

    logger.log(`create stream for ${uri.fsPath}`);
    const streamResult = tryCatchSync(
      () => {
        return createWriteStream(uri.fsPath);
      },
      (err) => ({
        type: "NoStream",
        reason: errorToString(err),
      })
    );
    if (!streamResult.success) {
      logger.error(streamResult);
      return;
    }
    const stream = unwrap(streamResult);
    await new Promise((resolve) => stream.on("open", resolve));
    logger.log(`stream is opened`);

    const formatter = createFormatter({
      writer: stream,
      config,
    });

    formatter.head({ flat });

    logger.log(`writing body`);

    const getStructuralRowsResult = await job.getStructuralRows();
    if (!getStructuralRowsResult.success) {
      logger.error(getStructuralRowsResult);
      return;
    }
    const structs = unwrap(getStructuralRowsResult);
    logger.log(`fetched ${structs.length} rows`);
    const page = job.getPage(table);
    logger.log(`page ${page.rowNumberStart} - ${page.rowNumberEnd}`);
    formatter.body({
      flat,
      structs,
      rowNumberStart: page.rowNumberStart,
    });
    logger.log(`written ${structs.length} rows`);

    while (job.hasNext()) {
      const getStructsResult = await job.getNextStructs();
      if (!getStructsResult.success) {
        const { reason } = unwrap(getStructsResult);
        logger.log(reason);
        return;
      }
      const structs = unwrap(getStructsResult);
      logger.log(`fetched ${structs.length} rows`);
      const page = job.getPage(table);
      logger.log(`page ${page.rowNumberStart} - ${page.rowNumberEnd}`);
      formatter.body({
        flat,
        structs,
        rowNumberStart: page.rowNumberStart,
      });
      logger.log(`written ${structs.length} rows`);
    }

    logger.log(`writing foot`);

    await formatter.foot();

    logger.log(`complete`);
  };
