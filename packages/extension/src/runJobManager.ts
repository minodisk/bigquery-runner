import { createClient, RunJob } from "core";
import { Metadata, Page, Routine, Struct, Table } from "core/src/types";
import { ConfigManager } from "./configManager";

export type RunJobManager = ReturnType<typeof createRunJobManager>;

export type RunJobResponse = SelectResponse | RoutineResponse;

export type SelectResponse = Readonly<{
  type: "select";
  jobId: string;
  metadata: Metadata;
  structs: Array<Struct>;
  table: Table;
  page: Page;
}>;

export type RoutineResponse = Readonly<{
  type: "routine";
  jobId: string;
  metadata: Metadata;
  routine: Routine;
}>;

export function createRunJobManager({
  configManager,
}: {
  readonly configManager: ConfigManager;
}) {
  const selectJobs: Map<string, RunJob> = new Map();

  return {
    async query({
      fileName,
      query,
    }: {
      readonly fileName: string;
      readonly query: string;
    }): Promise<RunJobResponse> {
      const config = configManager.get();
      const client = await createClient(config);
      let job = await client.createRunJob({
        query,
        maxResults: config.pagination.results,
      });
      // if (!job) {
      //   throw new Error(`no job`);
      // }
      // const metadata = await job.getMetadata();

      if (
        job.metadata.statistics.numChildJobs &&
        ["SCRIPT"].some((type) => job.statementType === type)
      ) {
        // Wait for completion of table creation job
        // to get the records of the table just created.
        const routine = await job.getRoutine();
        return {
          type: "routine",
          jobId: job.id,
          metadata: job.metadata,
          routine,
        };
      }

      if (
        ["CREATE_TABLE_AS_SELECT", "MERGE"].some(
          (type) => job.statementType === type
        ) &&
        job.tableName
      ) {
        // Wait for completion of table creation job
        // to get the records of the table just created.
        job = await client.createRunJob({
          query: `SELECT * FROM \`${job.tableName}\``,
          maxResults: config.pagination.results,
        });
      }

      selectJobs.set(fileName, job);

      const structs = await job.getStructs();
      const table = await job.getTable();
      const page = job.getPage({ table });

      return {
        type: "select",
        jobId: job.id,
        structs,
        metadata: job.metadata,
        table,
        page,
      };
    },

    async prevRows({
      fileName,
    }: {
      readonly fileName: string;
    }): Promise<SelectResponse> {
      const job = selectJobs.get(fileName);
      if (!job) {
        throw new Error(`no job`);
      }

      const structs = await job.getPrevStructs();
      const table = await job.getTable();
      const page = job.getPage({ table });

      return {
        type: "select",
        jobId: job.id,
        structs,
        metadata: job.metadata,
        table,
        page,
      };
    },

    async nextRows({
      fileName,
    }: {
      readonly fileName: string;
    }): Promise<SelectResponse> {
      const job = selectJobs.get(fileName);

      if (!job) {
        throw new Error(`no job`);
      }

      const structs = await job.getNextStructs();
      const table = await job.getTable();
      const page = job.getPage({ table });

      return {
        type: "select",
        jobId: job.id,
        structs,
        metadata: job.metadata,
        table,
        page,
      };
    },

    delete({ fileName }: { readonly fileName: string }) {
      return selectJobs.delete(fileName);
    },

    dispose() {
      selectJobs.clear();
    },
  };
}
