import { BigQuery } from "@google-cloud/bigquery";
import type {
  BigQueryOptions,
  Job,
  JobResponse,
  Query,
  TableField,
} from "@google-cloud/bigquery";
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
  TableReference,
  DatasetReference,
  ProjectID,
  DatasetID,
  TableID,
  ChildJob,
  RoutineReference,
  FieldReference,
} from "shared";
import {
  isChildDdlTableQuery,
  isChildDmlQuery,
  isChildDdlRoutineQuery,
  getTableName,
  errorToString,
  tryCatch,
  succeed,
  unwrap,
  fail,
} from "shared";

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
  getProjectId(): Promise<ProjectID>;
  getDatasets(): Promise<Array<DatasetReference>>;
  getTables(ref: DatasetReference): Promise<Array<TableReference>>;
  getFields(ref: TableReference): Promise<Array<FieldReference>>;
  deleteDataset(datasetId: DatasetID): Promise<void>;
  deleteTable(ref: { datasetId: DatasetID; tableId: TableID }): Promise<void>;
}>;
export type RunJob = Readonly<{
  metadata: Metadata;
  hasNext(): boolean;
  getStructuralRows(): Promise<
    Result<
      UnknownError | NoRowsError | NoPageTokenError,
      { structs: Array<StructuralRow>; page: Page }
    >
  >;
  getPagingStructuralRows(
    diff: number
  ): Promise<
    Result<
      UnknownError | NoRowsError | NoPageTokenError,
      { structs: Array<StructuralRow>; page: Page }
    >
  >;
  getTable(): Promise<Result<UnknownError | NoDestinationTableError, Table>>;
  getChildren(): Promise<
    Result<
      UnknownError | Err<"NoChildJob" | "NoRoutine">,
      {
        tables: Array<Table>;
        routines: Array<Routine>;
      }
    >
  >;
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
    getProjectId: bigQuery.getProjectId.bind(bigQuery),
  });

  const getTable = async (
    ref: TableReference
  ): Promise<Result<UnknownError, Table>> => {
    return tryCatch(
      async () => {
        const res = await bigQuery
          .dataset(ref.datasetId)
          .table(ref.tableId)
          .get();
        const table: Table = res.find(({ kind }) => kind === "bigquery#table");
        if (!table) {
          throw new Error(`table not found: ${getTableName(ref)}`);
        }
        return table;
      },
      (err) => ({
        type: "Unknown" as const,
        reason: errorToString(err),
      })
    );
  };

  const getRoutine = async (
    routine: RoutineReference
  ): Promise<Result<UnknownError, Routine>> => {
    return tryCatch(
      async () => {
        const { id, baseUrl, metadata } = (
          await bigQuery
            .dataset(routine.datasetId)
            .routine(routine.routineId)
            .get()
        )[0] as Routine;
        // Remove unnecessary data, including credentials
        return { id, baseUrl, metadata };
      },
      (err) => ({
        type: "Unknown" as const,
        reason: errorToString(err),
      })
    );
  };

  const client: Client = {
    async createRunJob(options) {
      const dryRunJobResult = await runQuery({
        createQueryJob: bigQuery.createQueryJob.bind(bigQuery),
        options: {
          ...options,
          dryRun: true,
        },
      });
      if (!dryRunJobResult.success) {
        return dryRunJobResult;
      }

      const runJobResult = await runQuery({
        createQueryJob: bigQuery.createQueryJob.bind(bigQuery),
        options: {
          ...options,
          dryRun: false,
        },
      });
      if (!runJobResult.success) {
        return runJobResult;
      }
      const job = unwrap(runJobResult);

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
        (err) => {
          return { type: "NoJob" as const, reason: String(err) } as NoJobError;
        }
      );
      if (!metadataResult.success) {
        return metadataResult;
      }
      const metadata = unwrap(metadataResult);

      const pages: Map<number, Page> = new Map();
      const tokens: Map<number, string> = new Map();
      let current = 0;

      const getStructuralRowsAt = async (index: number) => {
        const pageToken = tokens.get(index);
        if (index !== 0 && pageToken === undefined) {
          return fail({
            type: "NoPageToken" as const,
            reason: `no page token for page at ${index}`,
          });
        }

        const result = await tryCatch(
          async () => {
            return job.getQueryResults({
              maxResults: options.maxResults,
              pageToken,
            });
          },
          (err) => ({
            type: "Unknown" as const,
            reason: errorToString(err),
          })
        );
        if (!result.success) {
          return result;
        }
        const [structs, next, res] = result.value;
        current = index;

        if (!res?.totalRows) {
          return fail({
            type: "NoRows" as const,
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
      };

      const runJob: RunJob = {
        metadata,

        hasNext() {
          return !!tokens.get(current + 1);
        },

        async getStructuralRows() {
          return getStructuralRowsAt(0);
        },

        async getPagingStructuralRows(diff) {
          return getStructuralRowsAt(current + diff);
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

          return getTable(destinationTable);
        },

        async getChildren() {
          const getJobsResult = await tryCatch(
            async () => {
              const [jobs] = (await bigQuery.getJobs({
                parentJobId: job.id,
              })) as [ReadonlyArray<ChildJob>];
              return jobs;
            },
            (err) => ({
              type: "Unknown" as const,
              reason: errorToString(err),
            })
          );
          if (!getJobsResult.success) {
            return getJobsResult;
          }
          const jobs = getJobsResult.value;

          const queries = jobs.map(
            ({
              metadata: {
                statistics: { query },
              },
            }) => query
          );

          let tableRefs: Array<TableReference> = [];
          let routineRefs: Array<RoutineReference> = [];
          for (const query of queries) {
            if (isChildDmlQuery(query)) {
              tableRefs = [...tableRefs, ...query.referencedTables];
              break;
            }
            if (isChildDdlTableQuery(query)) {
              tableRefs = [...tableRefs, query.ddlTargetTable];
              break;
            }
            if (isChildDdlRoutineQuery(query)) {
              routineRefs = [...routineRefs, query.ddlTargetRoutine];
              break;
            }
          }

          const [tableResults, routineResults] = await Promise.all([
            Promise.all(tableRefs.map(getTable)),
            Promise.all(routineRefs.map(getRoutine)),
          ]);
          let tables: Array<Table> = [];
          let routines: Array<Routine> = [];
          for (const res of tableResults) {
            if (!res.success) {
              continue;
            }
            tables = [...tables, res.value];
          }
          for (const res of routineResults) {
            if (!res.success) {
              continue;
            }
            routines = [...routines, res.value];
          }

          return succeed({
            tables,
            routines,
          });
        },
      };

      return succeed(runJob);
    },

    async createDryRunJob(options) {
      const dryRunJobResult = await runQuery({
        createQueryJob: bigQuery.createQueryJob.bind(bigQuery),
        options: {
          ...options,
          dryRun: true,
        },
      });
      if (!dryRunJobResult.success) {
        return dryRunJobResult;
      }
      const job = unwrap(dryRunJobResult);
      const { totalBytesProcessed } = job.metadata.statistics;

      return succeed({
        id: job.id,
        totalBytesProcessed: parseInt(totalBytesProcessed, 10),
      });
    },

    async getProjectId() {
      return bigQuery.getProjectId();
    },

    async getDatasets() {
      const [datasets] = await bigQuery.getDatasets();
      return datasets.map((dataset) => dataset.metadata.datasetReference);
    },

    async getTables({ datasetId }) {
      const [tables] = await bigQuery.dataset(datasetId).getTables();
      return tables.map((table) => table.metadata.tableReference);
    },

    async getFields(ref) {
      const { datasetId, tableId } = ref;
      const [metadata] = await bigQuery
        .dataset(datasetId)
        .table(tableId)
        .getMetadata();
      return metadata.schema.fields.map((field: TableField) => ({
        ...ref,
        fieldId: field.name,
        type: field.type,
      }));
    },

    async deleteDataset(datasetId) {
      await bigQuery.dataset(datasetId).delete();
    },

    async deleteTable({ datasetId, tableId }) {
      await bigQuery.dataset(datasetId).table(tableId).delete();
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

export const runQuery = async ({
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
  if (totalRows === 0n) {
    // no page
    return {
      hasPrev: false,
      hasNext: false,
      startRowNumber: 0n,
      endRowNumber: 0n,
      totalRows,
    };
  }
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
