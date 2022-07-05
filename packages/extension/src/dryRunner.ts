import { format as formatBytes } from "bytes";
import { createClient } from "core";
import { RunnerID, unwrap } from "types";
import { TextDocument, TextEditor, window } from "vscode";
import { ConfigManager } from "./configManager";
import { ErrorMarkerManager } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import { isBigQuery } from "./isBigQuery";
import { Logger } from "./logger";
import { StatusManager } from "./statusManager";

export type DryRunner = ReturnType<typeof createDryRunner>;

export function createDryRunner({
  logger,
  configManager,
  statusManager,
  errorMarkerManager,
}: Readonly<{
  logger: Logger;
  configManager: ConfigManager;
  statusManager: StatusManager;
  errorMarkerManager: ErrorMarkerManager;
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

      const query = await getQueryText(editor);

      logger.log(`run`);
      status.loadProcessed();

      const config = configManager.get();

      const clientResult = await createClient(config);
      if (!clientResult.success) {
        const { reason } = unwrap(clientResult);
        logger.log(reason);
        status.errorProcessed();
        await window.showErrorMessage(reason);
        return;
      }
      const client = unwrap(clientResult);

      const dryRunJobResult = await client.createDryRunJob({
        query,
      });

      errorMarker.clear();
      if (!dryRunJobResult.success) {
        const err = unwrap(dryRunJobResult);
        logger.error(err);
        status.errorProcessed();
        if (err.type === "QueryWithPosition") {
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
