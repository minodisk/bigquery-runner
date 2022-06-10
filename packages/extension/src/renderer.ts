import { format as formatBytes } from "bytes";
import { createFlat, Output } from "core";
import { OutputChannel } from ".";
import { RunJobResponse } from "./runJobManager";
import { ErrorWithId } from "./runner";
import { StatusManager } from "./statusManager";

export type Renderer = ReturnType<typeof createRenderer>;

export function createRenderer({
  outputChannel,
  statusManager,
}: {
  readonly outputChannel: OutputChannel;
  readonly statusManager: StatusManager;
}) {
  return {
    async render({
      fileName,
      output,
      response,
    }: {
      readonly fileName: string;
      readonly output: Output;
      readonly response: RunJobResponse;
    }) {
      if (response.type === "routine") {
        const { metadata, routine } = response;
        output.writeRoutine({
          routine,
          metadata,
        });
        return;
      }
      try {
        const { metadata, structs, table, page } = response;

        statusManager.loadBilled({ fileName });

        outputChannel.appendLine(`Result: ${structs.length} rows`);
        const bytes = formatBytes(
          parseInt(metadata.statistics.query.totalBytesBilled, 10)
        );
        outputChannel.appendLine(
          `Result: ${bytes} to be billed (cache: ${metadata.statistics.query.cacheHit})`
        );

        if (table.schema.fields === undefined) {
          throw new Error("fields is not defined");
        }

        const flat = createFlat(table.schema.fields);
        await output.writeHeads({ flat });
        await output.writeRows({
          structs,
          flat,
          metadata,
          table,
          page,
        });

        // const bytesWritten = await output.bytesWritten();
        // if (bytesWritten !== undefined) {
        //   outputChannel.appendLine(
        //     `Total bytes written: ${formatBytes(bytesWritten)}`
        //   );
        // }

        statusManager.succeedBilled({
          fileName,
          billed: { bytes, cacheHit: metadata.statistics.query.cacheHit },
        });
      } catch (err) {
        statusManager.errorBilled({ fileName });
        // statusManager.hide();
        if (response.jobId) {
          throw new ErrorWithId(err, response.jobId);
        } else {
          throw err;
        }
      }
    },

    dispose() {
      // do nothing
    },
  };
}
