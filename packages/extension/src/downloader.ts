import { createWriteStream } from "fs";
import { format } from "bytes";
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
import type { Field, Format, Result, RunnerID, UnknownError } from "types";
import { formats, succeed, errorToString, tryCatchSync, unwrap } from "types";
import type { TextEditor, Uri } from "vscode";
import { workspace, window } from "vscode";
import { checksum } from "./checksum";
import type { Config } from "./config";
import type { ConfigManager } from "./configManager";
import { getQueryText } from "./getQueryText";
import type { Logger } from "./logger";
import type { StatusManager } from "./statusManager";

export type Downloader = ReturnType<typeof createDownloader>;

export function createDownloader({
  logger: parentLogger,
  configManager,
  statusManager,
}: Readonly<{
  logger: Logger;
  configManager: ConfigManager;
  statusManager: StatusManager;
}>) {
  const jsonl = createWriter({
    configManager,
    statusManager,
    logger: parentLogger.createChild("jsonl"),
    createFormatter: ({ writer }) => {
      return succeed(createJSONLinesFormatter({ writer }));
    },
  });
  const json = createWriter({
    configManager,
    statusManager,
    logger: parentLogger.createChild("json"),
    createFormatter({ writer }) {
      return succeed(createJSONFormatter({ writer }));
    },
  });
  const csv = createWriter({
    configManager,
    statusManager,
    logger: parentLogger.createChild("csv"),
    createFormatter({ fields, writer, config }) {
      const flatResult = createFlat(fields);
      if (!flatResult.success) {
        return flatResult;
      }
      const flat = unwrap(flatResult);

      return succeed(
        createCSVFormatter({
          flat,
          writer,
          options: config.downloader.csv,
        })
      );
    },
  });
  const markdown = createWriter({
    configManager,
    statusManager,
    logger: parentLogger.createChild("markdown"),
    createFormatter({ fields, writer }) {
      const flatResult = createFlat(fields);
      if (!flatResult.success) {
        return flatResult;
      }
      const flat = unwrap(flatResult);

      return succeed(createMarkdownFormatter({ flat, writer }));
    },
  });
  const text = createWriter({
    configManager,
    statusManager,
    logger: parentLogger.createChild("text"),
    createFormatter({ fields, writer }) {
      const flatResult = createFlat(fields);
      if (!flatResult.success) {
        return flatResult;
      }
      const flat = unwrap(flatResult);

      return succeed(createTableFormatter({ flat, writer }));
    },
  });

  const download = async ({
    runnerId,
    format,
    query,
  }: {
    runnerId: RunnerID;
    format: Format;
    query: string;
  }) => {
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
        return jsonl({ runnerId, query, uri });
      case "json":
        return json({ runnerId, query, uri });
      case "csv":
        return csv({ runnerId, query, uri });
      case "md":
        return markdown({ runnerId, query, uri });
      case "txt":
        return text({ runnerId, query, uri });
    }
  };

  return {
    async downloadWithEditor({
      format,
      editor,
    }: {
      format: Format;
      editor: TextEditor;
    }): Promise<void> {
      const runnerId: RunnerID = `file://${editor.document.fileName}`;
      const query = await getQueryText(editor);
      await download({ runnerId, format, query });
    },

    async downloadWithQuery({
      format,
      query,
    }: {
      format: Format;
      query: string;
    }): Promise<void> {
      const runnerId: RunnerID = `query://${checksum(query)}`;
      await download({ runnerId, format, query });
    },

    dispose() {
      // do nothing
    },
  };
}

const createWriter =
  ({
    configManager,
    statusManager,
    logger,
    createFormatter,
  }: {
    configManager: ConfigManager;
    statusManager: StatusManager;
    logger: Logger;
    createFormatter: (
      params: Readonly<{
        fields: ReadonlyArray<Field>;
        writer: NodeJS.WritableStream;
        config: Config;
      }>
    ) => Result<UnknownError, Formatter>;
  }) =>
  async ({
    runnerId,
    query,
    uri,
  }: {
    runnerId: RunnerID;
    query: string;
    uri: Uri;
  }) => {
    logger.log(`start downloading to ${uri.path}`);

    const status = statusManager.get(runnerId);
    status.loadBilled();

    const config = configManager.get();

    const createClientResult = await createClient(config);
    if (!createClientResult.success) {
      logger.error(createClientResult);
      status.errorBilled();
      return;
    }
    const client = unwrap(createClientResult);

    const createRunJobResult = await client.createRunJob({
      query,
      maxResults: config.downloader.rowsPerPage,
    });
    if (!createRunJobResult.success) {
      logger.error(createRunJobResult);
      status.errorBilled();
      return;
    }
    const job = unwrap(createRunJobResult);
    logger.log(`job created ${job.id}`);

    const getTableResult = await job.getTable();
    if (!getTableResult.success) {
      logger.error(getTableResult);
      status.errorBilled();
      return;
    }
    const table = unwrap(getTableResult);
    logger.log(`table fetched ${table.id}`);
    if (!table.schema.fields) {
      logger.error("no schema");
      status.errorBilled();
      return;
    }

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
      status.errorBilled();
      return;
    }
    const stream = unwrap(streamResult);
    await new Promise((resolve) => stream.on("open", resolve));
    logger.log(`stream is opened`);

    const createFormatterResult = createFormatter({
      fields: table.schema.fields,
      writer: stream,
      config,
    });
    if (!createFormatterResult.success) {
      logger.error(createFormatterResult);
      status.errorBilled();
      return;
    }
    const formatter = createFormatterResult.value;

    formatter.head();

    logger.log(`writing body`);

    const getStructuralRowsResult = await job.getStructuralRows();
    if (!getStructuralRowsResult.success) {
      logger.error(getStructuralRowsResult);
      status.errorBilled();
      return;
    }
    const structs = unwrap(getStructuralRowsResult);
    logger.log(`fetched ${structs.length} rows`);
    const page = job.getPage(table);
    logger.log(`page ${page.rowNumberStart} - ${page.rowNumberEnd}`);
    formatter.body({
      structs,
      rowNumberStart: page.rowNumberStart,
    });
    logger.log(`written ${structs.length} rows`);

    while (job.hasNext()) {
      const getStructsResult = await job.getNextStructs();
      if (!getStructsResult.success) {
        logger.error(getStructsResult);
        status.errorBilled();
        return;
      }
      const structs = unwrap(getStructsResult);
      logger.log(`fetched ${structs.length} rows`);
      const page = job.getPage(table);
      logger.log(`page ${page.rowNumberStart} - ${page.rowNumberEnd}`);
      formatter.body({
        structs,
        rowNumberStart: page.rowNumberStart,
      });
      logger.log(`written ${structs.length} rows`);
    }

    logger.log(`writing foot`);

    await formatter.foot();

    const { totalBytesBilled, cacheHit } = job.metadata.statistics.query;
    const bytes = format(parseInt(totalBytesBilled, 10));
    status.succeedBilled({ bytes, cacheHit });

    logger.log(`${bytes} to be billed (cache: ${cacheHit})`);
    logger.log(`complete`);
  };
