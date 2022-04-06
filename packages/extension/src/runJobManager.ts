import { createClient, RunInfo, RunJob } from "core";
import { Results } from "core/src/types";
import { ConfigManager } from "./configManager";

export type RunJobManager = ReturnType<typeof createRunJobManager>;

export type RunJobResponse = {
  readonly jobId: string;
  readonly destinationTable?: string;
  readonly results: Results;
  readonly info: RunInfo;
  readonly edge: Edge;
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

      const results = await job.getRows();
      const info = await job.getInfo();
      const edge = getEdge({ results, info });

      return {
        jobId: job.id,
        destinationTable: job.destinationTable,
        results,
        info,
        edge,
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
      const info = await job.getInfo();
      const edge = getEdge({ results, info });

      return {
        jobId: job.id,
        destinationTable: job.destinationTable,
        results,
        info,
        edge,
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
      const info = await job.getInfo();
      const edge = getEdge({ results, info });

      return {
        jobId: job.id,
        destinationTable: job.destinationTable,
        results,
        info,
        edge,
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

export type Edge = {
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
};
const getEdge = ({
  results,
  info,
}: {
  results: Results;
  info: RunInfo;
}): Edge => {
  if (results.page.maxResults === undefined) {
    return { hasPrev: false, hasNext: false };
  }
  const hasPrev = 0 < results.page.current;
  const hasNext =
    BigInt(results.page.maxResults) * BigInt(results.page.current + 1) <
    BigInt(info.numRows);
  return { hasPrev, hasNext };
};
