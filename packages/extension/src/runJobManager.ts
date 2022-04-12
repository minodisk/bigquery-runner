import { createClient, RunJob } from "core";
import { EdgeInfo, JobInfo, Struct, TableInfo } from "core/src/types";
import { ConfigManager } from "./configManager";

export type RunJobManager = ReturnType<typeof createRunJobManager>;

export type RunJobResponse = Readonly<{
  readonly jobId: string;
  readonly results: Array<Struct>;
  readonly jobInfo: JobInfo;
  readonly tableInfo: TableInfo;
  readonly edgeInfo: EdgeInfo;
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

      const results = await job.getRows();
      const jobInfo = await job.getJobInfo();
      const tableInfo = await job.getTableInfo({ jobInfo });
      const edgeInfo = job.getEdgeInfo({ tableInfo });

      return {
        jobId: job.id,
        results,
        jobInfo,
        tableInfo,
        edgeInfo,
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

      const results = await job.getPrevRows();
      const jobInfo = await job.getJobInfo();
      const tableInfo = await job.getTableInfo({ jobInfo });
      const edgeInfo = job.getEdgeInfo({ tableInfo });

      return {
        jobId: job.id,
        results,
        jobInfo,
        tableInfo,
        edgeInfo,
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

      const results = await job.getNextRows();
      const jobInfo = await job.getJobInfo();
      const tableInfo = await job.getTableInfo({ jobInfo });
      const edgeInfo = job.getEdgeInfo({ tableInfo });

      return {
        jobId: job.id,
        results,
        jobInfo,
        tableInfo,
        edgeInfo,
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
