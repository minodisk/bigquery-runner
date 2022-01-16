import { BigQuery, BigQueryOptions, Query } from "@google-cloud/bigquery";
import { Field } from ".";

export type JobInfo = {
  kind: string;
  etag: string;
  id: string;
  selfLink: string;
  // user_email: string;
  configuration: {
    query: {
      query: string;
      destinationTable: TableReference;
      writeDisposition: string;
      priority: string;
      useLegacySql: boolean;
    };
    jobType: string;
  };
  jobReference: {
    projectId: string;
    jobId: string;
    location: string;
  };
  statistics: {
    creationTime: string;
    startTime: string;
    endTime: string;
    totalBytesProcessed: string;
    query: {
      totalBytesProcessed: string;
      totalBytesBilled: string;
      cacheHit: boolean;
      statementType: string;
    };
  };
  status: {
    state: string;
  };
};

export type Table = {
  kind: string;
  etag: string;
  id: string;
  selfLink: string;
  tableReference: TableReference;
  schema: Schema;
  numBytes: string;
  numLongTermBytes: string;
  numRows: string;
  creationTime: string;
  expirationTime: string;
  lastModifiedTime: string;
  type: "TABLE";
  location: string;
};

export type Schema = {
  fields?: Array<Field>;
};

export type TableReference = {
  projectId: string;
  datasetId: string;
  tableId: string;
};

export type Client = ReturnType<typeof createClient> extends Promise<infer T>
  ? T
  : never;
export type RunJob = ReturnType<Client["createRunJob"]> extends Promise<infer T>
  ? T
  : never;
export type DryRunJob = ReturnType<Client["createDryRunJob"]> extends Promise<
  infer T
>
  ? T
  : never;
export class AuthenticationError extends Error {
  constructor(keyFilename?: string) {
    super(
      keyFilename
        ? `Bad authentication: Make sure that "${keyFilename}", which is set in bigqueryRunner.keyFilename of setting.json, is the valid path to service account key file`
        : `Bad authentication: Set bigqueryRunner.keyFilename of your setting.json to the valid path to service account key file`
    );
  }
}
export async function createClient(options: BigQueryOptions) {
  const bigQuery = new BigQuery(options);
  try {
    await bigQuery.authClient.getProjectId();
  } catch (err) {
    if (
      (err as { message: string }).message &&
      (err as { message: string }).message.startsWith(
        "Unable to detect a Project Id in the current environment."
      )
    ) {
      throw new AuthenticationError(options.keyFilename);
    }
  }

  return {
    async createRunJob(query: Omit<Query, "dryRun">) {
      const data = await bigQuery.createQueryJob({ ...query, dryRun: false });
      const job = data[0];
      if (!job.id) {
        throw new Error(`no job ID`);
      }

      let tokens: Map<number, string> = new Map();
      let page: number = 0;
      return {
        id: job.id,
        async getRows() {
          // nextQuery = undefined;
          const [rows, next] = await job.getQueryResults({
            maxResults: query.maxResults,
          });
          if (next?.pageToken) {
            tokens.set(page + 1, next.pageToken);
          }
          // nextQuery = next;
          return rows;
        },
        async getPrevRows() {
          const pageToken = tokens.get(page - 1);
          if (!pageToken) {
            throw new Error(`no page`);
          }
          page -= 1;
          const [rows, next] = await job.getQueryResults({
            maxResults: query.maxResults,
            pageToken,
          });
          if (next?.pageToken) {
            tokens.set(page + 1, next.pageToken);
          }
          return rows;
        },
        async getNextRows() {
          const pageToken = tokens.get(page + 1);
          if (!pageToken) {
            throw new Error(`no page`);
          }
          page += 1;
          const [rows, next] = await job.getQueryResults({
            maxResults: query.maxResults,
            pageToken,
          });
          if (next?.pageToken) {
            tokens.set(page + 1, next.pageToken);
          }
          return rows;
        },
        async getInfo() {
          const metadata = await job.getMetadata();
          const jobInfo: JobInfo | undefined = metadata.find(
            ({ kind }) => kind === "bigquery#job"
          );
          if (!jobInfo) {
            throw new Error(`no job info: ${job.id}`);
          }
          const {
            configuration: {
              query: {
                destinationTable: { projectId, datasetId, tableId },
              },
            },
            statistics: { query },
          } = jobInfo;

          const res = await bigQuery.dataset(datasetId).table(tableId).get();
          const table: Table = res.find(
            ({ kind }) => kind === "bigquery#table"
          );
          if (!table) {
            throw new Error(
              `no table info: ${projectId}.${datasetId}.${tableId}`
            );
          }
          const {
            schema: { fields },
          } = table;
          if (!fields) {
            throw new Error(`schema has no fields`);
          }
          return {
            query,
            schema: { fields },
          };
        },
      };
    },
    async createDryRunJob(query: Omit<Query, "dryRun">) {
      const data = await bigQuery.createQueryJob({ ...query, dryRun: true });
      const job = data[0];
      if (!job.id) {
        throw new Error(`no job ID`);
      }
      return {
        id: job.id,
        getInfo(): { totalBytesProcessed: number } {
          const { totalBytesProcessed } = job.metadata.statistics;
          return {
            totalBytesProcessed:
              typeof totalBytesProcessed === "number"
                ? totalBytesProcessed
                : typeof totalBytesProcessed === "string"
                ? parseInt(totalBytesProcessed, 10)
                : 0,
          };
        },
      };
    },
  };
}
