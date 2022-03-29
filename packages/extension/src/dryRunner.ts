import { format as formatBytes } from "bytes";
import { createClient, DryRunJob } from "core";
import { Range, TextDocument } from "vscode";
import { OutputChannel, Result } from ".";
import { ConfigManager } from "./configManager";
import { ErrorMarker } from "./errorMarker";
import { getQueryText } from "./runner";
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
    async run({
      document,
      selection,
    }: {
      readonly document: TextDocument;
      readonly selection?: Range;
    }): Promise<Result> {
      try {
        outputChannel.appendLine(`Dry run`);
        statusManager.loadProcessed({
          document,
        });

        const config = configManager.get();
        const client = await createClient(config);

        let job!: DryRunJob;
        try {
          errorMarker.clear({ document });
          job = await client.createDryRunJob({
            query: getQueryText({ document, range: selection }),
          });
          errorMarker.clear({ document });
        } catch (err) {
          errorMarker.mark({ document, err, selection });
          throw err;
        }

        outputChannel.appendLine(`Job ID: ${job.id}`);
        const { totalBytesProcessed } = job.getInfo();
        const bytes = formatBytes(totalBytesProcessed);
        outputChannel.appendLine(`Result: ${bytes} estimated to be read`);

        statusManager.succeedProcessed({
          document,
          processed: {
            bytes,
          },
        });

        return { jobId: job.id };
      } catch (err) {
        statusManager.errorProcessed({ document });
        throw err;
      }
    },

    dispose() {
      // do nothing
    },
  };
}
