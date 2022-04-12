import { BigQuery, BigQueryOptions, Job, Query } from "@google-cloud/bigquery";
import {
  EdgeInfo,
  JobInfo,
  SerializableEdgeInfo,
  Struct,
  TableInfo,
  TableReference,
} from "./types";

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

export class NoPageTokenError extends Error {
  constructor(page: number) {
    super(`no page token for page at ${page}`);
  }
}

function hasMessage(e: any): e is { message: string } {
  return typeof e.message === "string";
}

export async function createClient(options: BigQueryOptions) {
  const bigQuery = new BigQuery({
    scopes: [
      // Query Drive data: https://cloud.google.com/bigquery/external-data-drive
      "https://www.googleapis.com/auth/drive",
    ],
    ...options,
  });
  try {
    await bigQuery.authClient.getProjectId();
  } catch (err) {
    if (
      hasMessage(err) &&
      err.message.startsWith(
        "Unable to detect a Project ID in the current environment."
      )
    ) {
      throw new AuthenticationError(options.keyFilename);
    }
  }

  return {
    async createRunJob(query: Omit<Query, "dryRun">): Promise<{
      id: string;
      getRows(): Promise<Array<Struct>>;
      getPrevRows(): Promise<Array<Struct>>;
      getNextRows(): Promise<Array<Struct>>;
      getJobInfo(): Promise<JobInfo>;
      getTableInfo(params: { jobInfo: JobInfo }): Promise<TableInfo>;
      getEdgeInfo(params: { tableInfo: TableInfo }): EdgeInfo;
    }> {
      const [job, info] = await bigQuery.createQueryJob({
        ...query,
        dryRun: false,
      });
      const tableName = createTableName(
        info.configuration?.query?.destinationTable
      );

      if (
        ["CREATE_TABLE_AS_SELECT", "MERGE"].some(
          (type) => info.statistics?.query?.statementType === type
        ) &&
        tableName
      ) {
        // Wait for completion of table creation job
        // to get the records of the table just created.
        await getJobInfo({ job });

        return this.createRunJob({
          ...query,
          query: `select * from \`${tableName}\``,
        });
      }

      if (!job.id) {
        throw new Error(`no job ID`);
      }

      const tokens: Map<number, string | null> = new Map([[0, null]]);
      let current = 0;

      return {
        id: job.id,

        async getRows() {
          const [structs, next] = await job.getQueryResults({
            maxResults: query.maxResults,
          });
          if (next?.pageToken) {
            tokens.set(current + 1, next.pageToken);
          }
          return structs;
        },

        async getPrevRows() {
          const pageToken = tokens.get(current - 1);
          if (pageToken === undefined) {
            throw new NoPageTokenError(current - 1);
          }
          current -= 1;
          const [structs, next] = await job.getQueryResults({
            maxResults: query.maxResults,
            pageToken: pageToken ?? undefined,
          });
          if (next?.pageToken) {
            tokens.set(current + 1, next.pageToken);
          }
          return structs;
        },

        async getNextRows() {
          const pageToken = tokens.get(current + 1);
          if (pageToken === undefined) {
            throw new NoPageTokenError(current + 1);
          }
          current += 1;
          const [structs, next] = await job.getQueryResults({
            maxResults: query.maxResults,
            pageToken: pageToken ?? undefined,
          });
          if (next?.pageToken) {
            tokens.set(current + 1, next.pageToken);
          }
          return structs;
        },

        async getJobInfo() {
          return getJobInfo({ job });
        },

        async getTableInfo({ jobInfo }) {
          return getTableInfo({
            bigQuery,
            table: jobInfo.configuration.query.destinationTable,
          });
        },

        getEdgeInfo({ tableInfo }) {
          return getEdgeInfo({
            maxResults: query.maxResults,
            current,
            numRows: tableInfo.numRows,
          });
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

export function createTableName(table?: {
  projectId?: string;
  datasetId?: string;
  tableId?: string;
}): string | undefined {
  if (!table) {
    return;
  }
  const { projectId, datasetId, tableId } = table;
  return [projectId, datasetId, tableId].filter((v) => !!v).join(".");
}

async function getJobInfo({ job }: { job: Job }): Promise<JobInfo> {
  // Wait for a job to complete and get information abount the job.
  for (let i = 1; i <= 10; i++) {
    const metadata = await job.getMetadata();
    const info: JobInfo | undefined = metadata.find(
      ({ kind }) => kind === "bigquery#job"
    );
    if (!info) {
      continue;
    }
    if (info.status.state === "DONE") {
      return info;
    }
    if (i === 10) {
      break;
    }
    await sleep(1000);
  }
  throw new Error(`waiting for completion of table creation job timed out`);
}

async function getTableInfo({
  bigQuery,
  table,
}: {
  bigQuery: BigQuery;
  table: TableReference;
}): Promise<TableInfo> {
  const res = await bigQuery
    .dataset(table.datasetId)
    .table(table.tableId)
    .get();
  const tableInfo: TableInfo = res.find(
    ({ kind }) => kind === "bigquery#table"
  );
  if (!tableInfo) {
    throw new Error(`no table info: ${createTableName(table)}`);
  }
  return tableInfo;
}

function getEdgeInfo(params: {
  maxResults?: number;
  current: number;
  numRows: string;
}): EdgeInfo {
  const numRows = BigInt(params.numRows);
  if (params.maxResults === undefined) {
    return {
      hasPrev: false,
      hasNext: false,
      rowNumberStart: BigInt(1),
      rowNumberEnd: numRows,
    };
  }

  const maxResults = BigInt(params.maxResults);
  const current = BigInt(params.current);
  const next = current + 1n;
  const hasPrev = 0n < current;
  const hasNext = maxResults * next < numRows;
  const rowNumberStart = maxResults * current + 1n;
  const rowNumberEnd = hasNext ? maxResults * next : numRows;
  return {
    hasPrev,
    hasNext,
    rowNumberStart,
    rowNumberEnd,
  };
}

export function toSerializableEdgeInfo(
  edgeInfo: EdgeInfo
): SerializableEdgeInfo {
  return {
    ...edgeInfo,
    rowNumberStart: `${edgeInfo.rowNumberStart}`,
    rowNumberEnd: `${edgeInfo.rowNumberEnd}`,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
