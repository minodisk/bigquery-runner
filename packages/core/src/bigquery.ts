import { BigQuery, BigQueryOptions, Query } from "@google-cloud/bigquery";
import {
  Page,
  Metadata,
  SerializablePage,
  Table,
  Routine,
  tryCatch,
  type Error,
  Result,
  Struct,
  succeed,
  unwrap,
  UnknownError,
  StatementType,
} from "types";

export type NoJobError = Error<"NoJob">;
export type NoPageTokenError = Error<"NoPageToken">;
export type QueryError = Error<"Query">;
export type QueryWithPositionError = {
  type: "QueryWithPosition";
  reason: string;
  position: { line: number; character: number };
};

export type Client = Readonly<{
  createRunJob(
    query: Omit<Query, "dryRun" | "query"> & { query: string }
  ): Promise<Result<NoJobError | QueryError | QueryWithPositionError, RunJob>>;
  createDryRunJob(
    query: Omit<Query, "dryRun">
  ): Promise<
    Result<NoJobError | QueryError | QueryWithPositionError, DryRunJob>
  >;
}>;
export type RunJob = Readonly<{
  id?: string;
  query: string;
  metadata: Metadata;
  statementType?: StatementType;
  tableName?: string;
  hasNext(): boolean;
  getPage(table: Table): Page;
  getStructs(): Promise<Result<UnknownError, Array<Struct>>>;
  getPrevStructs(): Promise<
    Result<UnknownError | NoPageTokenError, Array<Struct>>
  >;
  getNextStructs(): Promise<
    Result<UnknownError | NoPageTokenError, Array<Struct>>
  >;
  getTable(): Promise<Result<UnknownError, Table>>;
  getRoutine(): Promise<Result<UnknownError, Routine>>;
}>;
export type DryRunJob = Readonly<{
  id?: string;
  getInfo(): { totalBytesProcessed: number };
}>;

export async function createClient(
  options: BigQueryOptions
): Promise<Result<Error<"Authentication">, Client>> {
  const bigQuery = new BigQuery({
    scopes: [
      // Query Drive data: https://cloud.google.com/bigquery/external-data-drive
      "https://www.googleapis.com/auth/drive",
    ],
    ...options,
  });

  // Check authentication
  try {
    await bigQuery.authClient.getProjectId();
  } catch (err) {
    if (
      String(err).startsWith(
        "Unable to detect a Project ID in the current environment."
      )
    ) {
      if (options.keyFilename) {
        return fail({
          type: "Authentication",
          reason: `Bad authentication: Make sure that "${options.keyFilename}", which is set in bigqueryRunner.keyFilename of setting.json, is the valid path to service account key file`,
        });
      }
      return fail({
        type: "Authentication",
        reason: `Bad authentication: Set bigqueryRunner.keyFilename of your setting.json to the valid path to service account key file`,
      });
    }
    return fail({
      type: "Unknown",
      reason: String(err),
    });
  }

  return succeed({
    async createRunJob(query) {
      const createQueryJobResult = await tryCatch(
        async () => {
          const [job] = await bigQuery.createQueryJob({
            ...query,
            dryRun: false,
          });
          return job;
        },
        (err) => {
          const reason = String(err);
          const rPosition = /^(.*?) at \[(\d+):(\d+)\]$/;
          const res = rPosition.exec(reason);
          if (!res) {
            return {
              type: "Query" as const,
              reason,
            };
          }

          const [_, r, l, c] = res;
          const line = Number(l) - 1;
          const character = Number(c) - 1;
          return {
            type: "QueryWithPosition" as const,
            reason: r ?? reason,
            position: { line, character },
          };
        }
      );
      if (!createQueryJobResult.success) {
        return createQueryJobResult;
      }
      const job = unwrap(createQueryJobResult);

      const metadataResult = await tryCatch(
        async () => {
          return await new Promise<Metadata>((resolve, reject) => {
            job.on("complete", (metadata) => {
              resolve(metadata);
              job.removeAllListeners();
            });
            job.on("error", (err) => {
              reject(err);
              job.removeAllListeners();
            });
          });
        },
        (err) => ({ type: "NoJob", reason: String(err) } as NoJobError)
      );
      if (!metadataResult.success) {
        return metadataResult;
      }
      const metadata = unwrap(metadataResult);

      const statementType = metadata.statistics.query.statementType;
      // const statementType = info.statistics?.query?.statementType as
      //   | StatementType
      //   | undefined;
      const tableName = createTableName(
        // info.configuration?.query?.destinationTable
        metadata.configuration.query.destinationTable
      );

      const tokens: Map<number, string | null> = new Map([[0, null]]);
      let current = 0;

      return succeed({
        id: job.id,
        query: query.query,
        metadata,
        statementType,
        tableName,

        hasNext() {
          return !!tokens.get(current + 1);
        },

        getPage(table) {
          return getPage({
            maxResults: query.maxResults,
            current,
            numRows: table.numRows,
          });
        },

        getStructs() {
          return tryCatch(
            async () => {
              const [structs, next] = await job.getQueryResults({
                maxResults: query.maxResults,
              });
              if (next?.pageToken) {
                tokens.set(current + 1, next.pageToken);
              }
              return structs;
            },
            (reason) => ({
              type: "Unknown",
              reason: String(reason),
            })
          );
        },

        async getPrevStructs() {
          const pageToken = tokens.get(current - 1);
          if (pageToken === undefined) {
            return fail({
              type: "NoPageToken",
              reason: `no page token for page at ${current - 1}`,
            });
          }
          current -= 1;

          return tryCatch(
            async () => {
              const [structs, next] = await job.getQueryResults({
                maxResults: query.maxResults,
                pageToken: pageToken ?? undefined,
              });
              if (next?.pageToken) {
                tokens.set(current + 1, next.pageToken);
              }
              return structs;
            },
            (reason) => ({
              type: "Unknown",
              reason: String(reason),
            })
          );
        },

        async getNextStructs() {
          const pageToken = tokens.get(current + 1);
          if (pageToken === undefined) {
            return fail({
              type: "NoPageToken",
              reason: `no page token for page at ${current + 1}`,
            });
          }
          current += 1;

          return tryCatch(
            async () => {
              const [structs, next] = await job.getQueryResults({
                maxResults: query.maxResults,
                pageToken: pageToken ?? undefined,
              });
              if (next?.pageToken) {
                tokens.set(current + 1, next.pageToken);
              }
              return structs;
            },
            (reason) => ({
              type: "Unknown",
              reason: String(reason),
            })
          );
        },

        getTable() {
          return tryCatch(
            async () => {
              const { destinationTable } = metadata.configuration.query;
              const ref = bigQuery
                .dataset(destinationTable.datasetId)
                .table(destinationTable.tableId);
              const res = await ref.get();
              const table: Table = res.find(
                ({ kind }) => kind === "bigquery#table"
              );
              if (!table) {
                throw new Error(
                  `table not found: ${createTableName(destinationTable)}`
                );
              }
              return table;
            },
            (reason) => ({
              type: "Unknown",
              reason: String(reason),
            })
          );
        },

        getRoutine() {
          return tryCatch(
            async () => {
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
            (reason) => ({
              type: "Unknown",
              reason: String(reason),
            })
          );
        },
      });
    },

    async createDryRunJob(query) {
      const createQueryJobResult = await tryCatch(
        async () => {
          const [job] = await bigQuery.createQueryJob({
            ...query,
            dryRun: true,
          });
          return job;
        },
        (err) => {
          const reason = String(err);
          const rPosition = /^(.*?) at \[(\d+):(\d+)\]$/;
          const res = rPosition.exec(reason);
          if (!res) {
            return {
              type: "Query" as const,
              reason,
            };
          }

          const [_, r, l, c] = res;
          const line = Number(l) - 1;
          const character = Number(c) - 1;
          return {
            type: "QueryWithPosition" as const,
            reason: r ?? reason,
            position: { line, character },
          };
        }
      );
      if (!createQueryJobResult.success) {
        return createQueryJobResult;
      }
      const job = unwrap(createQueryJobResult);

      const metadataResult = await tryCatch(
        async () => {
          return await new Promise<Metadata>((resolve, reject) => {
            job.on("complete", (metadata) => {
              resolve(metadata);
              job.removeAllListeners();
            });
            job.on("error", (err) => {
              reject(err);
              job.removeAllListeners();
            });
          });
        },
        (err) => ({ type: "NoJob", reason: String(err) } as NoJobError)
      );
      if (!metadataResult.success) {
        return metadataResult;
      }
      const metadata = unwrap(metadataResult);
      const { totalBytesProcessed } = metadata.statistics;

      const j: DryRunJob = {
        id: job.id,
        getInfo() {
          return {
            totalBytesProcessed: parseInt(totalBytesProcessed, 10),
          };
        },
      };
      return succeed(j);
    },
  });
}

export function createTableName(
  table?: Readonly<{
    projectId?: string;
    datasetId?: string;
    tableId?: string;
  }>
): string | undefined {
  if (!table) {
    return;
  }
  const { projectId, datasetId, tableId } = table;
  return [projectId, datasetId, tableId].filter((v) => !!v).join(".");
}

function getPage(
  params: Readonly<{
    maxResults?: number;
    current: number;
    numRows: string;
  }>
): Page {
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
