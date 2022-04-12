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
      response: { jobId, results, jobInfo, tableInfo, edgeInfo },
    }: {
      readonly fileName: string;
      readonly output: Output;
      readonly response: RunJobResponse;
    }) {
      try {
        statusManager.loadBilled({ fileName });

        outputChannel.appendLine(`Result: ${results.length} rows`);
        const bytes = formatBytes(
          parseInt(jobInfo.statistics.query.totalBytesBilled, 10)
        );
        outputChannel.appendLine(
          `Result: ${bytes} to be billed (cache: ${jobInfo.statistics.query.cacheHit})`
        );

        if (tableInfo.schema.fields === undefined) {
          throw new Error("fields is not defined");
        }

        const flat = createFlat(tableInfo.schema.fields);
        await output.writeHeads({ flat });
        await output.writeRows({
          structs: results,
          flat,
          jobInfo,
          tableInfo,
          edgeInfo,
        });

        // const bytesWritten = await output.bytesWritten();
        // if (bytesWritten !== undefined) {
        //   outputChannel.appendLine(
        //     `Total bytes written: ${formatBytes(bytesWritten)}`
        //   );
        // }

        statusManager.succeedBilled({
          fileName,
          billed: { bytes, cacheHit: jobInfo.statistics.query.cacheHit },
        });
      } catch (err) {
        statusManager.errorBilled({ fileName });
        // statusManager.hide();
        if (jobId) {
          throw new ErrorWithId(err, jobId);
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
