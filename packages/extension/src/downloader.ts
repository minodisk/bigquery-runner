import { createWriteStream } from "fs";
import { basename } from "path";
import { format, parse } from "bytes";
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
import type { Field, Format, RunnerID } from "shared";
import {
  isStandaloneStatistics,
  commas,
  formats,
  errorToString,
  tryCatchSync,
  unwrap,
} from "shared";
import type { TextEditor, Uri } from "vscode";
import { ProgressLocation, workspace, window } from "vscode";
import { checksum } from "./checksum";
import type { Config, ConfigManager } from "./configManager";
import { getQueryText } from "./getQueryText";
import type { Logger } from "./logger";
import type { StatusManager } from "./statusManager";
import { openProgress, showError, showInformation } from "./window";

export type Downloader = ReturnType<typeof createDownloader>;

export function createDownloader({
  logger,
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
    logger: logger.createChild("jsonl"),
    createFormatter: ({ writer }) => {
      return createJSONLinesFormatter({ writer });
    },
  });
  const json = createWriter({
    configManager,
    statusManager,
    logger: logger.createChild("json"),
    createFormatter({ writer }) {
      return createJSONFormatter({ writer });
    },
  });
  const csv = createWriter({
    configManager,
    statusManager,
    logger: logger.createChild("csv"),
    createFormatter({ fields, writer, config }) {
      const flat = createFlat(fields);
      return createCSVFormatter({
        flat,
        writer,
        options: config.downloader.csv,
      });
    },
  });
  const markdown = createWriter({
    configManager,
    statusManager,
    logger: logger.createChild("markdown"),
    createFormatter({ fields, writer }) {
      const flat = createFlat(fields);
      return createMarkdownFormatter({ flat, writer });
    },
  });
  const text = createWriter({
    configManager,
    statusManager,
    logger: logger.createChild("text"),
    createFormatter({ fields, writer }) {
      const flat = createFlat(fields);
      return createTableFormatter({ flat, writer });
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

      const queryTextResult = await getQueryText(editor);
      if (!queryTextResult.success) {
        logger.log(queryTextResult.value.reason);
        return;
      }
      const query = queryTextResult.value;

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
    ) => Formatter;
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
    logger.log(`start downloading to ${uri.fsPath}`);

    const { report, close } = openProgress({
      title: `Downloading to ${basename(uri.fsPath)}`,
      location: ProgressLocation.Notification,
    });

    const status = statusManager.get(runnerId);
    status.loadBilled();

    const config = configManager.get();

    const createClientResult = await createClient({
      keyFilename: config.keyFilename,
      projectId: config.projectId,
      location: config.location,
    });
    if (!createClientResult.success) {
      logger.error(createClientResult);
      status.errorBilled();
      await close();
      showError(createClientResult);
      return;
    }
    const client = unwrap(createClientResult);

    const createRunJobResult = await client.createRunJob({
      query,
      useLegacySql: config.useLegacySql,
      maximumBytesBilled: config.maximumBytesBilled
        ? parse(config.maximumBytesBilled).toString()
        : undefined,
      defaultDataset: config.defaultDataset,
      maxResults: config.downloader.rowsPerPage,
      // TODO implement params
    });
    if (!createRunJobResult.success) {
      logger.error(createRunJobResult);
      status.errorBilled();
      await close();
      showError(createRunJobResult);
      return;
    }
    const job = unwrap(createRunJobResult);

    const { statistics } = job.metadata;
    const cacheHit = isStandaloneStatistics(statistics)
      ? statistics.query.cacheHit
      : false;
    const bytes = format(parseInt(statistics.query.totalBytesBilled, 10));
    status.succeedBilled({ bytes, cacheHit });
    logger.log(`${bytes} to be billed (cache: ${cacheHit})`);
    report({ message: `${bytes} to be billed (cache: ${cacheHit})` });

    const getTableResult = await job.getTable();
    if (!getTableResult.success) {
      logger.error(getTableResult);
      await close();
      showError(getTableResult);
      return;
    }
    const table = unwrap(getTableResult);
    logger.log(`table fetched ${table.id}`);
    report({ message: `table fetched ${table.id}` });
    if (!table.schema.fields) {
      logger.error("no schema");
      await close();
      showError("no schema");
      return;
    }

    logger.log(`create stream for ${uri.fsPath}`);
    report({ message: `create stream for ${uri.fsPath}` });
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
      await close();
      showError(streamResult);
      return;
    }
    const stream = unwrap(streamResult);
    await new Promise((resolve) => stream.on("open", resolve));
    logger.log(`stream is opened`);
    report({ message: `stream is opened` });

    const formatter = createFormatter({
      fields: table.schema.fields,
      writer: stream,
      config,
    });

    logger.log(`writing head`);
    report({ message: `writing head` });
    formatter.head();

    logger.log(`writing body`);
    report({ message: `writing body` });
    const getStructuralRowsResult = await job.getStructuralRows();
    if (!getStructuralRowsResult.success) {
      logger.error(getStructuralRowsResult);
      await close();
      showError(getStructuralRowsResult);
      return;
    }
    const { structs, page } = unwrap(getStructuralRowsResult);
    logger.log(
      `fetched: ${page.startRowNumber} - ${page.endRowNumber} of ${page.totalRows}`
    );
    formatter.body({
      structs,
      rowNumberStart: page.startRowNumber,
    });
    logger.log(`written ${structs.length} rows`);
    report({
      message: `${commas(page.endRowNumber)} / ${commas(
        page.totalRows
      )} rows (${(page.endRowNumber * 100n) / page.totalRows}%)`,
      increment: Number((BigInt(structs.length) * 100n) / page.totalRows),
    });
    while (job.hasNext()) {
      const getStructsResult = await job.getPagingStructuralRows(1);
      if (!getStructsResult.success) {
        logger.error(getStructsResult);
        await close();
        showError(getStructsResult);
        return;
      }
      const { structs, page } = unwrap(getStructsResult);
      logger.log(
        `fetched: ${page.startRowNumber} - ${page.endRowNumber} of ${page.totalRows}`
      );
      formatter.body({
        structs,
        rowNumberStart: page.startRowNumber,
      });
      logger.log(`written ${structs.length} rows`);
      report({
        message: `${commas(page.endRowNumber)} / ${commas(
          page.totalRows
        )} rows (${(page.endRowNumber * 100n) / page.totalRows}%)`,
        increment: Number((BigInt(structs.length) * 100n) / page.totalRows),
      });
    }

    logger.log(`writing foot`);
    report({ message: `writing foot` });
    await formatter.foot();

    logger.log(`complete`);
    report({ message: `complete` });
    await close();

    showInformation(`Download completed to ${basename(uri.fsPath)}`, {
      Open: async () => {
        const doc = await workspace.openTextDocument(uri);
        await window.showTextDocument(doc);
      },
    });
  };
