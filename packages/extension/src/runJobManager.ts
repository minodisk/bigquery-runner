import { createClient, RunInfo, RunJob } from "core";
import { Results } from "core/src/types";
import { ConfigManager } from "./configManager";

export type RunJobManager = ReturnType<typeof createRunJobManager>;

export type RunJobResponse = {
  jobId: string;
  results: Results;
  info: RunInfo;
};

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
      return {
        jobId: job.id,
        results: await job.getRows(),
        info: await job.getInfo(),
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
      return {
        jobId: job.id,
        results: await job.getPrevRows(),
        info: await job.getInfo(),
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
      return {
        jobId: job.id,
        results: await job.getNextRows(),
        info: await job.getInfo(),
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
