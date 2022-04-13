import { createClient, RunJob } from "core";
import { Metadata, Page, Struct, Table } from "core/src/types";
import { ConfigManager } from "./configManager";

export type RunJobManager = ReturnType<typeof createRunJobManager>;

export type RunJobResponse = Readonly<{
  jobId: string;
  structs: Array<Struct>;
  metadata: Metadata;
  table: Table;
  page: Page;
}>;

export function createRunJobManager({
  configManager,
}: {
  readonly configManager: ConfigManager;
}) {
  const map: Map<string, RunJob> = new Map();

  return {
    async rows({
      fileName,
      query,
    }: {
      readonly fileName: string;
      readonly query: string;
    }): Promise<RunJobResponse> {
      const config = configManager.get();
      const client = await createClient(config);
      const job = await client.createRunJob({
        query,
        maxResults: config.pagination.results,
      });
      if (!job) {
        throw new Error(`no job`);
      }
      map.set(fileName, job);

      const structs = await job.getStructs();
      const metadata = await job.getMetadata();
      const table = await job.getTable({ metadata });
      const page = job.getPage({ table });

      return {
        jobId: job.id,
        structs,
        metadata,
        table,
        page,
      };
    },

    async prevRows({
      fileName,
    }: {
      readonly fileName: string;
    }): Promise<RunJobResponse> {
      const job = map.get(fileName);
      if (!job) {
        throw new Error(`no job`);
      }

      const structs = await job.getPrevStructs();
      const metadata = await job.getMetadata();
      const table = await job.getTable({ metadata });
      const page = job.getPage({ table });

      return {
        jobId: job.id,
        structs,
        metadata,
        table,
        page,
      };
    },

    async nextRows({
      fileName,
    }: {
      readonly fileName: string;
    }): Promise<RunJobResponse> {
      const job = map.get(fileName);

      if (!job) {
        throw new Error(`no job`);
      }

      const structs = await job.getNextStructs();
      const metadata = await job.getMetadata();
      const table = await job.getTable({ metadata });
      const page = job.getPage({ table });

      return {
        jobId: job.id,
        structs,
        metadata,
        table,
        page,
      };
    },

    delete({ fileName }: { readonly fileName: string }) {
      return map.delete(fileName);
    },

    dispose() {
      map.clear();
    },
  };
}
