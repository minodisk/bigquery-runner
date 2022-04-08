import { format as formatBytes } from "bytes";
import {
  AuthenticationError,
  createClient,
  DryRunJob,
  NoPageTokenError,
} from "core";
import { window } from "vscode";
import { OutputChannel } from ".";
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
    async run(): Promise<void> {
      try {
        if (!window.activeTextEditor) {
          return;
        }
        const textEditor = window.activeTextEditor;
        const fileName = textEditor.document.fileName;
        const selections = textEditor.selections;
        const query = await getQueryText({
          document: textEditor.document,
          selections,
        });

        try {
          outputChannel.appendLine(`Dry run`);
          statusManager.loadProcessed({
            fileName,
          });

          const config = configManager.get();
          const client = await createClient(config);

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
        if (
          err instanceof AuthenticationError ||
          err instanceof NoPageTokenError
        ) {
          window.showErrorMessage(`${err.message}`);
        }
      }
    },

    dispose() {
      // do nothing
    },
  };
}
