import { BigQuery, BigQueryOptions, Job, Query } from "@google-cloud/bigquery";
import {
  Page,
  Metadata,
  SerializablePage,
  Struct,
  Table,
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
    async createRunJob(query: Omit<Query, "dryRun">): Promise<
      Readonly<{
        id: string;
        getStructs(): Promise<Array<Struct>>;
        getPrevStructs(): Promise<Array<Struct>>;
        getNextStructs(): Promise<Array<Struct>>;
        getMetadata(): Promise<Metadata>;
        getTable(params: { metadata: Metadata }): Promise<Table>;
        getPage(params: { table: Table }): Page;
      }>
    > {
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
        await getMetadata({ job });

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

        async getStructs() {
          const [structs, next] = await job.getQueryResults({
            maxResults: query.maxResults,
          });
          if (next?.pageToken) {
            tokens.set(current + 1, next.pageToken);
          }
          return structs;
        },

        async getPrevStructs() {
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

        async getNextStructs() {
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

        async getMetadata() {
          return getMetadata({ job });
        },

        async getTable({ metadata }) {
          return getTable({
            bigQuery,
            table: metadata.configuration.query.destinationTable,
          });
        },

        getPage({ table }) {
          return getPage({
            maxResults: query.maxResults,
            current,
            numRows: table.numRows,
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

async function getMetadata({ job }: { job: Job }): Promise<Metadata> {
  // Wait for a job to complete and get information abount the job.
  for (let i = 1; i <= 10; i++) {
    const metadata = await job.getMetadata();
    const info: Metadata | undefined = metadata.find(
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

async function getTable({
  bigQuery,
  table,
}: {
  bigQuery: BigQuery;
  table: TableReference;
}): Promise<Table> {
  const res = await bigQuery
    .dataset(table.datasetId)
    .table(table.tableId)
    .get();
  const t: Table = res.find(({ kind }) => kind === "bigquery#table");
  if (!t) {
    throw new Error(`no table info: ${createTableName(table)}`);
  }
  return t;
}

function getPage(params: {
  maxResults?: number;
  current: number;
  numRows: string;
}): Page {
  const numRows = BigInt(params.numRows);
  if (params.maxResults === undefined) {
    return {
      hasPrev: false,
      hasNext: false,
      rowNumberStart: BigInt(1),
      rowNumberEnd: numRows,
      numRows,
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
    numRows,
  };
}

export function toSerializablePage(page: Page): SerializablePage {
  return {
    ...page,
    rowNumberStart: `${page.rowNumberStart}`,
    rowNumberEnd: `${page.rowNumberEnd}`,
    numRows: `${page.numRows}`,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
