import { format as formatBytes, parse } from "bytes";
import { createClient } from "core";
import type { RunnerID } from "shared";
import { unwrap } from "shared";
import type { TextDocument, TextEditor } from "vscode";
import { window } from "vscode";
import type { ConfigManager } from "./configManager";
import type { ErrorMarkerManager } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import { isBigQuery } from "./isBigQuery";
import type { Logger } from "./logger";
import type { QuickFixManager } from "./quickfix";
import type { StatusManager } from "./statusManager";

export type DryRunner = ReturnType<typeof createDryRunner>;

export function createDryRunner({
  logger,
  configManager,
  statusManager,
  errorMarkerManager,
  quickFixManager,
}: Readonly<{
  logger: Logger;
  configManager: ConfigManager;
  statusManager: StatusManager;
  errorMarkerManager: ErrorMarkerManager;
  quickFixManager: QuickFixManager;
}>) {
  const pathTimeoutId = new Map<RunnerID, NodeJS.Timeout>();

  return {
    async validateWithDocument(document: TextDocument): Promise<void> {
      await Promise.all(
        window.visibleTextEditors
          .filter((editor) => editor.document === document)
          .map((editor) => this.validate(editor))
      );
    },

    async validate(editor: TextEditor): Promise<void> {
      const { document } = editor;
      const { fileName } = document;

      const config = configManager.get();
      if (!isBigQuery({ config, document }) || !config.validation.enabled) {
        return;
      }

      const runnerId: RunnerID = `file://${fileName}`;
      const timeoutId = pathTimeoutId.get(runnerId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        pathTimeoutId.delete(runnerId);
      }
      pathTimeoutId.set(
        runnerId,
        setTimeout(async () => {
          logger.log(`validate`);
          await this.run(editor);
        }, config.validation.debounceInterval)
      );
    },

    async run(editor: TextEditor): Promise<void> {
      const {
        document: { fileName },
      } = editor;

      const runnerId: RunnerID = `file://${fileName}`;
      const status = statusManager.get(runnerId);
      const errorMarker = errorMarkerManager.get({
        runnerId,
        editor,
      });
      const quickFix = quickFixManager.get(editor.document);

      const query = await getQueryText(editor);

      logger.log(`run`);
      status.loadProcessed();

      const config = configManager.get();

      const clientResult = await createClient({
        keyFilename: config.keyFilename,
        projectId: config.projectId,
        location: config.location,
      });
      if (!clientResult.success) {
        logger.error(clientResult);

        const { reason } = unwrap(clientResult);
        status.errorProcessed();
        await window.showErrorMessage(reason);
        return;
      }
      const client = unwrap(clientResult);

      const dryRunJobResult = await client.createDryRunJob({
        query,
        useLegacySql: config.useLegacySql,
        maximumBytesBilled: config.maximumBytesBilled
          ? parse(config.maximumBytesBilled).toString()
          : undefined,
        defaultDataset: config.defaultDataset,
        maxResults: config.viewer.rowsPerPage,
      });

      errorMarker.clear();
      quickFix.clear();
      if (!dryRunJobResult.success) {
        logger.error(dryRunJobResult);

        const err = unwrap(dryRunJobResult);
        status.errorProcessed();
        if (err.type === "QueryWithPosition") {
          if (err.suggestion) {
            quickFix.register({
              start: err.position,
              ...err.suggestion,
            });
          }
          errorMarker.markAt({
            reason: err.reason,
            position: err.position,
          });
          return;
        }
        if (err.type === "Query") {
          errorMarker.markAll({ reason: err.reason });
          return;
        }
        await window.showErrorMessage(err.reason);
        return;
      }
      errorMarker.clear();
      quickFix.clear();

      const job = unwrap(dryRunJobResult);

      logger.log(`job ID: ${job.id}`);
      const bytes = formatBytes(job.totalBytesProcessed);
      logger.log(`result: ${bytes} estimated to be read`);

      status.succeedProcessed({
        bytes,
      });
    },

    dispose() {
      pathTimeoutId.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      pathTimeoutId.clear();
    },
  };
}
