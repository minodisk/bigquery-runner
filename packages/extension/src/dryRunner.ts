import { format as formatBytes } from "bytes";
import { createClient, DryRunJob } from "core";
import { unwrap } from "types";
import { OutputChannel, TextDocument, window } from "vscode";
import { ConfigManager } from "./configManager";
import { ErrorMarker } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import { ErrorWithId } from "./runner";
import { StatusManager } from "./statusManager";

export type DryRunner = ReturnType<typeof createDryRunner>;

export function createDryRunner({
  outputChannel,
  configManager,
  statusManager,
  errorMarker,
}: {
  readonly outputChannel: OutputChannel;
  readonly configManager: ConfigManager;
  readonly statusManager: StatusManager;
  readonly errorMarker: ErrorMarker;
}) {
  return {
    async run({ document }: { document: TextDocument }): Promise<void> {
      try {
        const fileName = document.fileName;
        const textEditor = window.visibleTextEditors.find(
          (e) => e.document.fileName === fileName
        );
        const selections = textEditor?.selections ?? [];
        const query = await getQueryText({
          document,
          selections,
        });

        try {
          outputChannel.appendLine(`Dry run`);
          statusManager.loadProcessed({
            fileName,
          });

          const config = configManager.get();

          const clientResult = await createClient(config);
          if (!clientResult.success) {
            const { reason } = unwrap(clientResult);
            outputChannel.appendLine(reason);
            await window.showErrorMessage(reason);
            return;
          }
          const client = unwrap(clientResult);

          let job!: DryRunJob;
          try {
            errorMarker.clear({ fileName });
            job = await client.createDryRunJob({
              query,
            });
            errorMarker.clear({ fileName });
          } catch (err) {
            errorMarker.mark({ fileName, err, selections });
            throw err;
          }

          outputChannel.appendLine(`Job ID: ${job.id}`);
          const { totalBytesProcessed } = job.getInfo();
          const bytes = formatBytes(totalBytesProcessed);
          outputChannel.appendLine(`Result: ${bytes} estimated to be read`);

          statusManager.succeedProcessed({
            fileName,
            processed: {
              bytes,
            },
          });
        } catch (err) {
          statusManager.errorProcessed({ fileName });
          throw err;
        }
      } catch (err) {
        if (err instanceof ErrorWithId) {
          outputChannel.appendLine(`${err.error} (${err.id})`);
        } else {
          outputChannel.appendLine(`${err}`);
        }
      }
    },

    dispose() {
      // do nothing
    },
  };
}
