import { createWriteStream } from "fs";
import {
  createClient,
  createCSVFormatter,
  createFlat,
  createJSONFormatter,
  createJSONLinesFormatter,
  createMarkdownFormatter,
  createTableFormatter,
  Formatter,
} from "core";
import { unwrap } from "types";
import { Uri } from "vscode";
import { Config } from "./config";
import { ConfigManager } from "./configManager";
import { Logger } from "./logger";

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
      createFormatter: () => createJSONLinesFormatter(),
    }),
    json: createWriter({
      configManager,
      logger: parentLogger.createChild("json"),
      createFormatter: () => createJSONFormatter(),
    }),
    csv: createWriter({
      configManager,
      logger: parentLogger.createChild("csv"),
      createFormatter: (config) => createCSVFormatter(config.csv),
    }),
    markdown: createWriter({
      configManager,
      logger: parentLogger.createChild("markdown"),
      createFormatter: () => createMarkdownFormatter(),
    }),
    text: createWriter({
      configManager,
      logger: parentLogger.createChild("text"),
      createFormatter: () => createTableFormatter(),
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
    createFormatter: (config: Config) => Formatter;
  }) =>
  async ({ uri, query }: { uri: Uri; query: string }) => {
    const config = configManager.get();

    const createClientResult = await createClient(config);
    if (!createClientResult.success) {
      const { reason } = unwrap(createClientResult);
      logger.log(reason);
      return;
    }
    const client = unwrap(createClientResult);

    const createRunJobResult = await client.createRunJob({
      query,
    });
    if (!createRunJobResult.success) {
      const { reason } = unwrap(createRunJobResult);
      logger.log(reason);
      return;
    }
    const job = unwrap(createRunJobResult);

    const getTableResult = await job.getTable();
    if (!getTableResult.success) {
      logger.error(unwrap(getTableResult));
      return;
    }
    const table = unwrap(getTableResult);
    if (!table.schema.fields) {
      logger.error("no schema");
      return;
    }

    const flatResult = createFlat(table.schema.fields);
    if (!flatResult.success) {
      logger.error(unwrap(flatResult));
      return;
    }
    const flat = unwrap(flatResult);

    const stream = createWriteStream(uri.path);

    const formatter = createFormatter(config);

    stream.write(formatter.head({ flat }));

    const getStructsResult = await job.getStructs();
    if (!getStructsResult.success) {
      const { reason } = unwrap(getStructsResult);
      logger.log(reason);
      return;
    }
    const structs = unwrap(getStructsResult);
    const page = job.getPage(table);
    stream.write(
      await formatter.body({
        flat,
        structs,
        rowNumberStart: page.rowNumberStart,
      })
    );

    while (job.hasNext()) {
      const getStructsResult = await job.getStructs();
      if (!getStructsResult.success) {
        const { reason } = unwrap(getStructsResult);
        logger.log(reason);
        return;
      }
      const structs = unwrap(getStructsResult);
      const page = job.getPage(table);
      stream.write(
        await formatter.body({
          flat,
          structs,
          rowNumberStart: page.rowNumberStart,
        })
      );
    }

    stream.write(formatter.foot());
  };
