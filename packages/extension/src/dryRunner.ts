import { format as formatBytes, parse } from "bytes";
import { createClient } from "core";
import type { RunnerID } from "shared";
import { unwrap } from "shared";
import type { TextDocument, TextEditor } from "vscode";
import { window } from "vscode";
import { getCompiledQuery } from "./compiler";
import type { ConfigManager } from "./configManager";
import type { ErrorManager } from "./errorManager";
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
  errorManager,
  errorMarkerManager,
  quickFixManager,
}: Readonly<{
  logger: Logger;
  configManager: ConfigManager;
  statusManager: StatusManager;
  errorManager: ErrorManager;
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

      const queryTextResult = await getQueryText(editor);
      if (!queryTextResult.success) {
        errorMarker.clear();
        quickFix.clear();
        return;
      }

      const config = configManager.get();

      const query = queryTextResult.value;
      const compiledQuery = await getCompiledQuery(query, config.libsRoot);
      const didCompilerRun = query.localeCompare(compiledQuery) !== 0;

      logger.log(`run`);
      status.loadProcessed();

      const clientResult = await createClient({
        keyFilename: config.keyFilename,
        projectId: config.projectId,
        location: config.location,
      });
      if (!clientResult.success) {
        logger.error(clientResult);
        status.errorProcessed();
        const err = unwrap(clientResult);
        errorManager.show(err);
        return;
      }
      const client = unwrap(clientResult);

      const dryRunJobResult = await client.createDryRunJob({
        query: compiledQuery,
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

        if (err.type === "QueryWithPosition" && !didCompilerRun) {
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
        if (err.type === "Query" && !didCompilerRun) {
          errorMarker.markAll({
            reason: err.reason,
          });
          return;
        }

        errorManager.show(err);
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
