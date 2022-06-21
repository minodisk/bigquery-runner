import { createWriteStream } from "fs";
import { createClient } from "core";
import { Uri } from "vscode";
import { ConfigManager } from "./configManager";

export type Downloader = ReturnType<typeof createDownloader>;

export function createDownloader({
  configManager,
}: Readonly<{
  configManager: ConfigManager;
}>) {
  return {
    async jsonl({ uri, query }: { uri: Uri; query: string }) {
      const config = configManager.get();
      const client = await createClient(config);
      const job = await client.createRunJob({
        query,
      });

      const stream = createWriteStream(uri.path);

      function writeLine(line: any) {
        stream.write(JSON.stringify(line) + "\n");
      }

      (await job.getStructs()).map(writeLine);
      while (job.hasNext()) {
        (await job.getNextStructs()).map(writeLine);
      }
    },

    dispose() {
      // do nothing
    },
  };
}
