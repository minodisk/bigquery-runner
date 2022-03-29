import { createClient, RunInfo, RunJob } from "core";
import { Results } from "core/src/types";
import { Range, TextDocument } from "vscode";
import { ConfigManager } from "./configManager";
import { ErrorMarker } from "./errorMarker";
import { getQueryText } from "./runner";

export type RunJobManager = ReturnType<typeof createRunJobManager>;

export type RunJobResponse = {
  jobId: string;
  results: Results;
  info: RunInfo;
};

export function createRunJobManager({
  configManager,
  errorMarker,
}: {
  readonly configManager: ConfigManager;
  readonly errorMarker: ErrorMarker;
}) {
  const map: Map<string, RunJob> = new Map();

  return {
    async rows({
      document,
      selection,
    }: {
      readonly document: TextDocument;
      readonly selection?: Range;
    }): Promise<RunJobResponse> {
      const config = configManager.get();
      const client = await createClient(config);
      let job: RunJob | undefined;
      try {
        errorMarker.clear({ document });
        job = await client.createRunJob({
          query: getQueryText({ document, range: selection }),
          maxResults: config.pagination.results,
        });
        errorMarker.clear({ document });
      } catch (err) {
        errorMarker.mark({ document, err, selection });
        throw err;
      }
      if (!job) {
        throw new Error(`no job`);
      }
      map.set(document.fileName, job);
      return {
        jobId: job.id,
        results: await job.getRows(),
        info: await job.getInfo(),
      };
    },

    async prevRows({
      document,
    }: {
      readonly document: TextDocument;
    }): Promise<RunJobResponse> {
      const job = map.get(document.fileName);
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
      document,
    }: {
      readonly document: TextDocument;
    }): Promise<RunJobResponse> {
      const job = map.get(document.fileName);
      if (!job) {
        throw new Error(`no job`);
      }
      return {
        jobId: job.id,
        results: await job.getNextRows(),
        info: await job.getInfo(),
      };
    },

    delete({ document }: { readonly document: TextDocument }) {
      return map.delete(document.fileName);
    },

    dispose() {
      map.clear();
    },
  };
}
