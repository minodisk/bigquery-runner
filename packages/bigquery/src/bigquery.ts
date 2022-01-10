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
  fields?: Array<Field>;
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
type PrimitiveFieldType = typeof premitiveTableFieldTypes[number];
const structTableFieldTypes = ["RECORD", "STRUCT"] as const;
type StructFieldType = typeof structTableFieldTypes[number];

export type PrimitiveField = {
  name: string;
  type: PrimitiveFieldType;
  mode: FieldMode;
};
// function isPrimitiveTableField(
//   field: TableField
// ): field is PrimitiveTableField {
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
export type StructField = {
  name: string;
  type: StructFieldType;
  mode: FieldMode;
  fields: Array<Field>;
};
// function isStructTableField(field: TableField): field is StructTableField {
//   return ["RECORD", "STRUCT"].includes(field.type);
// }
export type Field = PrimitiveField | StructField;
export type FieldType = PrimitiveFieldType | StructFieldType;
export type FieldMode = "NULLABLE" | "REQUIRED" | "REPEATED";

export type Header = {
  name: string;
  type: FieldType;
  mode: FieldMode;
};

export type Struct = { [name: string]: NestedValue };
export type NestedValue =
  | PrimitiveValue
  | Struct
  | Array<PrimitiveValue | Struct>;
export type PrimitiveValue =
  | null
  | number
  | string
  | boolean
  | BigQueryDate
  | BigQueryDatetime
  | BigQueryInt
  | BigQueryTime
  | BigQueryTimestamp;

export type FlatRow = Array<FlatRowField>;
export type FlatRowField = null | number | string | boolean;

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

export function fieldsToHeader(fields?: Array<Field>): Array<Header> {
  if (!fields) {
    return [];
  }
  return fields.flatMap((field) => {
    if (field.type === "STRUCT" || field.type === "RECORD") {
      return fieldsToHeader(field.fields).map((f) => ({
        name: `${field.name}.${f.name}`,
        type: f.type,
        mode: f.mode,
      }));
    }
    return field;
  });
}

type Accessor = Field & { y: number };

function fieldsToAccessorsList(fields: Array<Field>): Array<Array<Accessor>> {
  return fields.flatMap((field) => {
    if (field.type === "STRUCT" || field.type === "RECORD") {
      return fieldsToAccessorsList(field.fields).map((fs) => [
        { ...field, y: 0 },
        ...fs,
      ]);
    }
    return [[{ ...field, y: 0 }]];
  });
}

export function flatRows({
  fields,
  rows,
}: {
  fields: Array<Field>;
  rows: Array<Struct>;
}): Array<FlatRow> {
  return rows.flatMap((row) => flatRow({ fields, row }));
}

//      x:0            x:1            x:2
// y:0 [accessor[0][0] accessor[1][0] accessor[2][0]]
// y:1 [undefined      accessor[1][1] accessor[2][1]]
// y:2 [undefined      accessor[1][2]               ]
export function flatRow({
  fields,
  row,
}: {
  fields: Array<Field>;
  row: Struct;
}): Array<FlatRow> {
  const accessorsList = fieldsToAccessorsList(fields);
  const rows: Array<FlatRow> = [];
  // console.log("------------------------------");
  // console.log("row:", row);
  // console.dir(accessors, { depth: 10 });
  accessorsList.forEach((accessors, x) => {
    walk({
      row,
      fieldIndex: x,
      accessorIndex: 0,
      accessors,
      rows,
    });
  });
  console.log("rows:", rows);

  return rows;
}

function walk({
  row,
  accessorIndex,
  fieldIndex,
  accessors,
  rows,
}: {
  row: Struct;
  accessorIndex: number;
  fieldIndex: number;
  accessors: Array<Accessor>;
  rows: Array<FlatRow>;
}) {
  let val: any = row;
  for (let ai = accessorIndex; ai < accessors.length; ai += 1) {
    const accessor = accessors[ai]!;
    if (accessor.mode === "REPEATED") {
      if (accessor.type === "STRUCT" || accessor.type === "RECORD") {
        val[accessor.name].forEach((struct: any) => {
          walk({
            row: struct,
            fieldIndex,
            accessorIndex: ai + 1,
            accessors,
            rows,
          });
        });
        break;
      }
      (val[accessor.name] as Array<PrimitiveValue>).forEach((v) => {
        if (!rows[accessor.y]) {
          rows[accessor.y] = [];
        }
        rows[accessor.y]![fieldIndex] = cast(v);
        accessor.y += 1;
      });
    } else {
      if (!rows[accessor.y]) {
        rows[accessor.y] = [];
      }
      if (accessor.type === "STRUCT" || accessor.type === "RECORD") {
        val = val[accessor.name];
        continue;
      }
      rows[accessor.y]![fieldIndex] = cast(val[accessor.name]);
      accessor.y += 1;
    }
  }
}

function cast(value: PrimitiveValue): FlatRowField {
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
