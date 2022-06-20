import { BigQuery, BigQueryOptions, Query } from "@google-cloud/bigquery";
import {
  Page,
  Metadata,
  SerializablePage,
  Struct,
  Table,
  Routine,
} from "types";

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

export type StatementType =
  | "SELECT"
  | "CREATE_TABLE_AS_SELECT"
  | "MERGE"
  | "SCRIPT";

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
        metadata: Metadata;
        statementType?: StatementType;
        tableName?: string;
        getStructs(): Promise<Array<Struct>>;
        getPrevStructs(): Promise<Array<Struct>>;
        getNextStructs(): Promise<Array<Struct>>;
        getTable(): Promise<Table>;
        getRoutine(): Promise<Routine>;
        getPage(params: { table: Table }): Page;
      }>
    > {
      const [job, info] = await bigQuery.createQueryJob({
        ...query,
        dryRun: false,
      });
      const metadata = await new Promise<Metadata>((resolve, reject) => {
        job.on("complete", (metadata) => {
          resolve(metadata);
          job.removeAllListeners();
        });
        job.on("error", () => {
          reject();
          job.removeAllListeners();
        });
      });

      const statementType = info.statistics?.query?.statementType as
        | StatementType
        | undefined;
      const tableName = createTableName(
        info.configuration?.query?.destinationTable
      );

      if (!job.id) {
        throw new Error(`no job ID`);
      }

      const tokens: Map<number, string | null> = new Map([[0, null]]);
      let current = 0;

      return {
        id: job.id,
        metadata,
        statementType,
        tableName,

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

        async getTable() {
          const table = metadata.configuration.query.destinationTable;
          const res = await bigQuery
            .dataset(table.datasetId)
            .table(table.tableId)
            .get();
          const t: Table = res.find(({ kind }) => kind === "bigquery#table");
          if (!t) {
            throw new Error(`no table info: ${createTableName(table)}`);
          }
          return t;
        },

        async getRoutine() {
          const [[j]] = await bigQuery.getJobs({ parentJobId: job.id });
          if (!j) {
            throw new Error(`no routine`);
          }
          const routine = j?.metadata.statistics.query.ddlTargetRoutine;
          if (!routine) {
            throw new Error(`no routine`);
          }
          return (
            await bigQuery
              .dataset(routine.datasetId)
              .routine(routine.routineId)
              .get()
          )[0] as Routine;
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
