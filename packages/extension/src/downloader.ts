import { createWriteStream } from "fs";
import { createClient } from "core";
import { Struct, unwrap } from "types";
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

      const createClientResult = await createClient(config);
      if (!createClientResult.success) {
        const { reason } = unwrap(createClientResult);
        console.log(reason);
        return;
      }
      const client = unwrap(createClientResult);

      const createRunJobResult = await client.createRunJob({
        query,
      });
      if (!createRunJobResult.success) {
        const { reason } = unwrap(createRunJobResult);
        console.log(reason);
        return;
      }
      const job = unwrap(createRunJobResult);

      const stream = createWriteStream(uri.path);
      const writeLine = (line: Struct) =>
        stream.write(JSON.stringify(line) + "\n");

      const getStructsResult = await job.getStructs();
      if (!getStructsResult.success) {
        const { reason } = unwrap(getStructsResult);
        console.log(reason);
        return;
      }
      const structs = unwrap(getStructsResult);
      structs.forEach(writeLine);

      while (job.hasNext()) {
        const getStructsResult = await job.getStructs();
        if (!getStructsResult.success) {
          const { reason } = unwrap(getStructsResult);
          console.log(reason);
          return;
        }
        const structs = unwrap(getStructsResult);
        structs.forEach(writeLine);
      }
    },

    dispose() {
      // do nothing
    },
  };
}
