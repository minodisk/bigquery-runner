import type {
  BigQueryOptions,
  Job,
  JobResponse,
  Query,
} from "@google-cloud/bigquery";
import { BigQuery } from "@google-cloud/bigquery";
import type {
  Page,
  Metadata,
  SerializablePage,
  Table,
  Routine,
  Result,
  StructuralRow,
  UnknownError,
  Err,
} from "types";
import {
  getTableName,
  errorToString,
  tryCatch,
  succeed,
  unwrap,
  fail,
} from "types";

export type AuthenticationError = Err<"Authentication">;
export type NoJobError = Err<"NoJob">;
export type NoDestinationTableError = Err<"NoDestinationTable">;
export type NoPageTokenError = Err<"NoPageToken">;
export type QueryError = Err<"Query">;
export type QueryWithPositionError = {
  type: "QueryWithPosition";
  reason: string;
  position: { line: number; character: number };
  suggestion?: { before: string; after: string };
};
export type NoRowsError = Err<"NoRows">;

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
  metadata: Metadata;
  hasNext(): boolean;
  getStructuralRows(): Promise<
    Result<
      UnknownError | NoRowsError,
      { structs: Array<StructuralRow>; page: Page }
    >
  >;
  getPrevStructs(): Promise<
    Result<
      UnknownError | NoRowsError | NoPageTokenError,
      { structs: Array<StructuralRow>; page: Page }
    >
  >;
  getNextStructs(): Promise<
    Result<
      UnknownError | NoRowsError | NoPageTokenError,
      { structs: Array<StructuralRow>; page: Page }
    >
  >;
  getTable(): Promise<Result<UnknownError | NoDestinationTableError, Table>>;
  getRoutine(): Promise<Result<UnknownError, Routine>>;
}>;
export type DryRunJob = Readonly<{
  id?: string;
  totalBytesProcessed: number;
}>;

export async function createClient(
  options: BigQueryOptions
): Promise<Result<Err<"Authentication" | "Unknown">, Client>> {
  const bigQuery = new BigQuery({
    scopes: [
      // Query Drive data: https://cloud.google.com/bigquery/external-data-drive
      "https://www.googleapis.com/auth/drive",
    ],
    ...options,
  });

  // Check authentication
  await checkAuthentication({
    keyFilename: options.keyFilename,
    getProjectId: bigQuery.getProjectId,
  });

  const client: Client = {
    async createRunJob(query) {
      const createQueryJobResult = await createQueryJob({
        createQueryJob: bigQuery.createQueryJob,
        options: {
          ...query,
          dryRun: false,
        },
      });
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
        (err) => ({ type: "NoJob" as const, reason: String(err) } as NoJobError)
      );
      if (!metadataResult.success) {
        return metadataResult;
      }
      const metadata = unwrap(metadataResult);

      const pages: Map<number, Page> = new Map();
      const tokens: Map<number, string | null> = new Map([[0, null]]);
      let current = 0;

      const runJob: RunJob = {
        metadata,

        hasNext() {
          return !!tokens.get(current + 1);
        },

        async getStructuralRows() {
          const result = await tryCatch(
            async () => {
              return await job.getQueryResults({
                maxResults: query.maxResults,
              });
            },
            (reason) => ({
              type: "Unknown" as const,
              reason: String(reason),
            })
          );
          if (!result.success) {
            return result;
          }
          const [structs, next, res] = result.value;

          if (!res?.totalRows) {
            return fail({
              type: "NoRows",
              reason: `no rows in the query result`,
            });
          }

          const page = getPage({
            totalRows: res.totalRows,
            rows: structs.length,
            prevPage: pages.get(current - 1),
            nextPageToken: next?.pageToken,
          });
          pages.set(current, page);
          if (next?.pageToken) {
            tokens.set(current + 1, next.pageToken);
          }

          return succeed({ structs, page });
        },

        async getPrevStructs() {
          const pageToken = tokens.get(current - 1);
          if (pageToken === undefined) {
            return fail({
              type: "NoPageToken" as const,
              reason: `no page token for page at ${current - 1}`,
            });
          }
          current -= 1;

          const result = await tryCatch(
            async () => {
              return job.getQueryResults({
                maxResults: query.maxResults,
                pageToken: pageToken ?? undefined,
              });
            },
            (reason) => ({
              type: "Unknown" as const,
              reason: String(reason),
            })
          );
          if (!result.success) {
            return result;
          }
          const [structs, next, res] = result.value;

          if (!res?.totalRows) {
            return fail({
              type: "NoRows",
              reason: `no rows in the query result`,
            });
          }

          const page = getPage({
            totalRows: res.totalRows,
            rows: structs.length,
            prevPage: pages.get(current - 1),
            nextPageToken: next?.pageToken,
          });
          pages.set(current, page);
          if (next?.pageToken) {
            tokens.set(current + 1, next.pageToken);
          }

          return succeed({ structs, page });
        },

        async getNextStructs() {
          const pageToken = tokens.get(current + 1);
          if (pageToken === undefined) {
            return fail({
              type: "NoPageToken" as const,
              reason: `no page token for page at ${current + 1}`,
            });
          }
          current += 1;

          const result = await tryCatch(
            async () => {
              return job.getQueryResults({
                maxResults: query.maxResults,
                pageToken: pageToken ?? undefined,
              });
            },
            (reason) => ({
              type: "Unknown" as const,
              reason: String(reason),
            })
          );
          if (!result.success) {
            return result;
          }
          const [structs, next, res] = result.value;

          if (!res?.totalRows) {
            return fail({
              type: "NoRows",
              reason: `no rows in the query result`,
            });
          }

          const page = getPage({
            totalRows: res.totalRows,
            rows: structs.length,
            prevPage: pages.get(current - 1),
            nextPageToken: next?.pageToken,
          });
          pages.set(current, page);
          if (next?.pageToken) {
            tokens.set(current + 1, next.pageToken);
          }

          return succeed({ structs, page });
        },

        async getTable() {
          const { destinationTable } = metadata.configuration.query;
          if (!destinationTable) {
            // maybe CREATE PROCEDURE
            return fail({
              type: "NoDestinationTable" as const,
              reason: "destination table is not defined",
            });
          }

          return tryCatch(
            async () => {
              const ref = bigQuery
                .dataset(destinationTable.datasetId)
                .table(destinationTable.tableId);
              const res = await ref.get();
              const table: Table = res.find(
                ({ kind }) => kind === "bigquery#table"
              );
              if (!table) {
                throw new Error(
                  `table not found: ${getTableName(destinationTable)}`
                );
              }
              return table;
            },
            (reason) => ({
              type: "Unknown" as const,
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
              const { id, baseUrl, metadata } = (
                await bigQuery
                  .dataset(routine.datasetId)
                  .routine(routine.routineId)
                  .get()
              )[0] as Routine;
              // Remove unnecessary data, including credentials
              return { id, baseUrl, metadata };
            },
            (reason) => ({
              type: "Unknown" as const,
              reason: String(reason),
            })
          );
        },
      };

      return succeed(runJob);
    },

    async createDryRunJob(query) {
      const createQueryJobResult = await createQueryJob({
        createQueryJob: bigQuery.createQueryJob,
        options: {
          ...query,
          dryRun: true,
        },
      });
      if (!createQueryJobResult.success) {
        return createQueryJobResult;
      }
      const job = unwrap(createQueryJobResult);
      const { totalBytesProcessed } = job.metadata.statistics;

      return succeed({
        id: job.id,
        totalBytesProcessed: parseInt(totalBytesProcessed, 10),
      });
    },
  };

  return succeed(client);
}

export const checkAuthentication = async ({
  keyFilename,
  getProjectId,
}: {
  keyFilename?: string;
  getProjectId(): Promise<string>;
}): Promise<Result<UnknownError | AuthenticationError, string>> => {
  return tryCatch(
    async () => getProjectId(),
    (err) => {
      const reason = errorToString(err);
      if (
        reason.startsWith(
          "Unable to detect a Project ID in the current environment."
        )
      ) {
        if (keyFilename) {
          return {
            type: "Authentication" as const,
            reason: `Bad authentication: Make sure that "${keyFilename}", which is set in bigqueryRunner.keyFilename of setting.json, is the valid path to service account key file`,
          };
        }
        return {
          type: "Authentication" as const,
          reason: `Bad authentication: Set bigqueryRunner.keyFilename of your setting.json to the valid path to service account key file`,
        };
      }
      return {
        type: "Unknown" as const,
        reason,
      };
    }
  );
};

export const createQueryJob = async ({
  createQueryJob,
  options,
}: {
  createQueryJob(options: Query | string): Promise<JobResponse>;
  options: Query;
}): Promise<Result<QueryError | QueryWithPositionError, Job>> => {
  return tryCatch(
    async () => {
      const [job] = await createQueryJob(options);
      return job;
    },
    (err: unknown) => {
      const reason = errorToString(err);
      const rPosition = /^(.+?) at \[(\d+?):(\d+?)\]$/;
      const rPositionResult = rPosition.exec(reason);
      if (!rPositionResult) {
        return {
          type: "Query" as const,
          reason,
        };
      }

      const [, r, l, c] = rPositionResult;
      const line = Number(l) - 1;
      const character = Number(c) - 1;

      if (!r?.startsWith("Unrecognized name: ")) {
        return {
          type: "QueryWithPosition" as const,
          reason: r ?? "No reason",
          position: { line, character },
        };
      }

      const rSuggestion = /^Unrecognized name: (.+?); Did you mean (.+?)\?$/;
      const rSuggestionResult = rSuggestion.exec(r);

      if (!rSuggestionResult) {
        return {
          type: "QueryWithPosition" as const,
          reason: r,
          position: { line, character },
        };
      }
      const [, before, after] = rSuggestionResult;
      if (!before || !after) {
        return {
          type: "QueryWithPosition" as const,
          reason: r,
          position: { line, character },
        };
      }

      return {
        type: "QueryWithPosition" as const,
        reason: r,
        position: { line, character },
        suggestion: { before, after },
      };
    }
  );
};

export function getPage(props: {
  totalRows: string;
  rows: number;
  prevPage?: Pick<Page, "endRowNumber">;
  nextPageToken?: string;
}): Page {
  const totalRows = BigInt(props.totalRows);
  const rows = BigInt(props.rows);
  const hasNext = !!props.nextPageToken;
  if (!props.prevPage) {
    // 1st page
    return {
      hasPrev: false,
      hasNext,
      startRowNumber: 1n,
      endRowNumber: rows,
      totalRows,
    };
  }
  // n-th page
  return {
    hasPrev: true,
    hasNext,
    startRowNumber: props.prevPage.endRowNumber + 1n,
    endRowNumber: props.prevPage.endRowNumber + rows,
    totalRows,
  };
}

export function toSerializablePage(page: Page): SerializablePage {
  return {
    ...page,
    startRowNumber: `${page.startRowNumber}`,
    endRowNumber: `${page.endRowNumber}`,
    totalRows: `${page.totalRows}`,
  };
}
