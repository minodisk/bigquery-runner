import {
  BigQuery,
  BigQueryDate,
  BigQueryDatetime,
  BigQueryInt,
  BigQueryTime,
  BigQueryTimestamp,
  Job,
} from "@google-cloud/bigquery";

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
  schema: TableSchema;
  numBytes: string;
  numLongTermBytes: string;
  numRows: string;
  creationTime: string;
  expirationTime: string;
  lastModifiedTime: string;
  type: "TABLE";
  location: string;
};

export type TableReference = {
  projectId: string;
  datasetId: string;
  tableId: string;
};

export type TableSchema = {
  fields?: Array<TableField>;
};

const premitiveTableFieldTypes = [
  "STRING",
  "BYTES",
  "INTEGER",
  "INT64",
  "FLOAT",
  "FLOAT64",
  "NUMERIC",
  "BIGNUMERIC",
  "BOOLEAN",
  "BOOL",
  "TIMESTAMP",
  "DATE",
  "TIME",
  "DATETIME",
  "INTERVAL",
] as const;
type PremitiveTableFieldType = typeof premitiveTableFieldTypes[number];
const structTableFieldTypes = ["RECORD", "STRUCT"] as const;
type StructTableFieldType = typeof structTableFieldTypes[number];

export type PremitiveTableField = {
  name: string;
  mode: TableFieldMode;
  type: PremitiveTableFieldType;
};
// function isPremitiveTableField(
//   field: TableField
// ): field is PremitiveTableField {
//   return [
//     "STRING",
//     "BYTES",
//     "INTEGER",
//     "INT64",
//     "FLOAT",
//     "FLOAT64",
//     "NUMERIC",
//     "BIGNUMERIC",
//     "BOOLEAN",
//     "BOOL",
//     "TIMESTAMP",
//     "DATE",
//     "TIME",
//     "DATETIME",
//     "INTERVAL",
//   ].includes(field.type);
// }
export type StructTableField = {
  name: string;
  mode: TableFieldMode;
  type: StructTableFieldType;
  fields: Array<TableField>;
};
// function isStructTableField(field: TableField): field is StructTableField {
//   return ["RECORD", "STRUCT"].includes(field.type);
// }
export type TableField = PremitiveTableField | StructTableField;
export type TableFieldMode = "NULLABLE" | "REQUIRED" | "REPEATED";
export type TableFieldType = PremitiveTableFieldType | StructTableFieldType;

export async function getJobInfo({ job }: { job: Job }): Promise<JobInfo> {
  const metadata = await job.getMetadata();
  const jobInfo: JobInfo | undefined = metadata.find(
    ({ kind }) => kind === "bigquery#job"
  );
  if (!jobInfo) {
    throw new Error(`no job info: ${job.id}`);
  }
  return jobInfo;
}

export async function getTableInfo({
  keyFilename,
  tableReference: { projectId, datasetId, tableId },
}: {
  readonly keyFilename: string;
  readonly tableReference: TableReference;
}): Promise<Table> {
  const bigQuery = new BigQuery({
    keyFilename,
    projectId: projectId,
  });
  const res = await bigQuery.dataset(datasetId).table(tableId).get();
  const table: Table = res.find(({ kind }) => kind === "bigquery#table");
  if (!table) {
    throw new Error(`no table info: ${projectId}.${datasetId}.${tableId}`);
  }
  return table;
}

export function flatRows({
  fields,
  rows,
}: {
  fields: Array<TableField>;
  rows: Array<any>;
}): Array<
  Array<{
    name: string;
    type: TableFieldType;
    mode: TableFieldMode;
    value: null | boolean | number | string | Date;
  }>
> {
  return rows.map((row) => flatRow({ fields, row }));
}

export function flatRow({
  fields,
  row,
}: {
  fields: Array<TableField>;
  row: any;
}): Array<{
  name: string;
  type: TableFieldType;
  mode: TableFieldMode;
  value: null | boolean | number | string | Date;
}> {
  return fields.flatMap((field) => {
    const value = row[field.name ?? ""];
    if (field.mode === "REPEATED") {
      if (field.type === "STRUCT" || field.type === "RECORD") {
        return flatRows({
          fields: field.fields,
          rows: value,
        }).map((fs) =>
          fs.map((f) => ({
            ...f,
            name: `${field.name}.${f.name}`,
          }))
        );
      }
      return value.map((v: null | boolean | number | string) => {
        return {
          name: field.name ?? "",
          type: field.type ?? "STRING",
          mode: field.mode ?? "NULLABLE",
          value: cast(v),
        };
      });
    }
    if (field.type === "STRUCT" || field.type === "RECORD") {
      return flatRow({
        fields: field.fields,
        row: value,
      });
    }
    return {
      name: field.name ?? "",
      type: field.type ?? "STRING",
      mode: field.mode ?? "NULLABLE",
      value: cast(value),
    };
  });
}

function cast(
  value:
    | null
    | number
    | string
    | boolean
    | BigQueryDate
    | BigQueryDatetime
    | BigQueryInt
    | BigQueryTime
    | BigQueryTimestamp
): null | number | string | boolean {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return value.value;
}

export function fieldsToHeader(fields?: Array<TableField>): Array<string> {
  if (!fields) {
    return [];
  }
  return fields.flatMap((field) => {
    if (field.type === "STRUCT" || field.type === "RECORD") {
      return fieldsToHeader(field.fields).map(
        (name) => `${field.name}.${name}`
      );
    }
    return field.name;
  });
}
