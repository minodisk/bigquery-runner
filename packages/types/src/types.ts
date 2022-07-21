import type {
  BigQueryDate,
  BigQueryDatetime,
  BigQueryInt,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
} from "@google-cloud/bigquery";
import type { Err } from "./error";

export type RunnerID = `${"file" | "query"}://${string}`;

export type Field = PrimitiveField | StructField;
export type PrimitiveField = Readonly<{
  name: string;
  type: PrimitiveFieldType;
  mode: FieldMode;
}>;
export type StructField = Readonly<{
  name: string;
  type: StructFieldType;
  mode: FieldMode;
  fields: ReadonlyArray<Field>;
}>;

export type FieldType = PrimitiveFieldType | StructFieldType;
const primitiveTableFieldTypes = [
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
export type PrimitiveFieldType = typeof primitiveTableFieldTypes[number];

const structTableFieldTypes = ["RECORD", "STRUCT"] as const;
export type StructFieldType = typeof structTableFieldTypes[number];

export type FieldMode = "NULLABLE" | "REQUIRED" | "REPEATED";

export type Column = ReadonlyArray<Accessor>;
export type Accessor = Readonly<{
  id: string;
  name: string;
  type: FieldType;
  mode: FieldMode;
}>;

export type StructuralRow = Readonly<{
  [name: string]: Value | StructuralRow | ReadonlyArray<Value | StructuralRow>;
}>;
export type Value =
  | null
  | number
  | string
  | boolean
  | bigint
  | Buffer
  | Geography
  | BigQueryDate
  | BigQueryDatetime
  | BigQueryInt
  | BigQueryTime
  | BigQueryTimestamp;

export type Primitive = null | number | string | boolean;

export type NumberedRows = Readonly<{
  rowNumber: string;
  rows: ReadonlyArray<Row>;
}>;

export type Row = Array<Cell>;
export type Cell = Readonly<{
  id: string;
  value?: Primitive;
}>;

export type Hash = {
  [id: string]: Value;
};

export type Data<E extends RendererEvent> = Readonly<{
  source: "bigquery-runner";
  payload: E;
}>;

export type RendererEvent =
  | FocusedEvent
  | StartProcessingEvent
  | MetadataEvent
  | TableEvent
  | RoutineEvent
  | RowsEvent
  | SuccessProcessingEvent
  | FailProcessingEvent
  | MoveTabFocusEvent
  | FocusOnTabEvent;

export type FocusedEvent = Readonly<{
  event: "focused";
  payload: {
    focused: boolean;
  };
}>;

export type StartProcessingEvent = Readonly<{
  event: "startProcessing";
}>;

export type MetadataEvent = Readonly<{
  event: "metadata";
  payload: MetadataPayload;
}>;
export type MetadataPayload = {
  metadata: Metadata;
};

export type TableEvent = Readonly<{
  event: "table";
  payload: TablePayload;
}>;
export type TablePayload = {
  heads: ReadonlyArray<Accessor>;
  table: Table;
};

export type RoutineEvent = Readonly<{
  event: "routine";
  payload: RoutinePayload;
}>;
export type RoutinePayload = {
  routine: Routine;
};

export type RowsEvent = Readonly<{
  event: "rows";
  payload: RowsPayload;
}>;
export type RowsPayload = Readonly<{
  heads: ReadonlyArray<Accessor>;
  rows: ReadonlyArray<NumberedRows>;
  page: SerializablePage;
}>;

export type SuccessProcessingEvent = Readonly<{
  event: "successProcessing";
}>;

export type FailProcessingEvent = Readonly<{
  event: "failProcessing";
  payload: Err<string>;
}>;

export type MoveTabFocusEvent = Readonly<{
  event: "moveTabFocus";
  payload: {
    diff: number;
  };
}>;

export type FocusOnTabEvent = Readonly<{
  event: "focusOnTab";
  payload: {
    tab: Tab;
  };
}>;

export const tabs = ["Rows", "Table", "Schema", "Routine", "Job"] as const;
export type Tab = typeof tabs[number];

export type RunInfo = Readonly<{
  metadata: Metadata;
  table: Table;
  page: Page;
}>;

export type Metadata = Readonly<{
  kind: string;
  etag: string;
  id: string;
  selfLink: string;
  configuration: Readonly<{
    query: Readonly<{
      query: string;
      destinationTable?: TableReference;
      writeDisposition: string;
      priority: string;
      useLegacySql: boolean;
    }>;
    jobType: string;
  }>;
  jobReference: JobReference;
  statistics: Readonly<{
    creationTime: string;
    startTime: string;
    endTime: string;
    numChildJobs?: string;
    totalBytesProcessed: string;
    query: {
      totalBytesProcessed: string;
      totalBytesBilled: string;
      cacheHit: boolean;
      statementType: StatementType;
    };
  }>;
  status: Readonly<{
    state: string;
  }>;
  user_email: string;
}>;

export type JobReference = Readonly<{
  projectId: string;
  location: string;
  jobId: string;
}>;

export type StatementType =
  | "SELECT"
  | "CREATE_TABLE_AS_SELECT"
  | "MERGE"
  | "SCRIPT";

export type Table = Readonly<{
  creationTime: string;
  etag: string;
  expirationTime?: string;
  id: string;
  kind: string;
  lastModifiedTime: string;
  location: string;
  numActiveLogicalBytes: string;
  numBytes: string;
  numLongTermBytes: string;
  numLongTermLogicalBytes: string;
  numRows: string;
  numTotalLogicalBytes: string;
  schema: Schema;
  selfLink: string;
  tableReference: TableReference;
  type: "TABLE";
}>;

export type Routine = Readonly<{
  id: string;
  baseUrl: string;
  metadata: Readonly<{
    creationTime: string;
    definitionBody: string;
    etag: string;
    language: "SQL";
    lastModifiedTime: string;
    routineReference: RoutineReference;
    routineType: "PROCEDURE";
  }>;
}>;

export type RoutineReference = Readonly<{
  projectId: string;
  datasetId: string;
  routineId: string;
}>;

export type Schema = Readonly<{
  fields: ReadonlyArray<Field>;
}>;

export type TableReference = Readonly<{
  projectId: string;
  datasetId: string;
  tableId: string;
}>;

export type Page = Readonly<{
  hasPrev: boolean;
  hasNext: boolean;
  startRowNumber: bigint;
  endRowNumber: bigint;
  totalRows: bigint;
}>;

export type SerializablePage = Readonly<{
  hasPrev: boolean;
  hasNext: boolean;
  startRowNumber: string;
  endRowNumber: string;
  totalRows: string;
}>;

export type ViewerEvent =
  | LoadedEvent
  | StartEvent
  | EndEvent
  | PrevEvent
  | NextEvent
  | DownloadEvent
  | PreviewEvent;
export type LoadedEvent = Readonly<{
  event: "loaded";
}>;
export type StartEvent = Readonly<{
  event: "start";
}>;
export type EndEvent = Readonly<{
  event: "end";
}>;
export type PrevEvent = Readonly<{
  event: "prev";
}>;
export type NextEvent = Readonly<{
  event: "next";
}>;
export type DownloadEvent = Readonly<{
  event: "download";
  format: Format;
}>;
export type PreviewEvent = Readonly<{
  event: "preview";
}>;

export const formats = {
  jsonl: "JSON Lines",
  json: "JSON",
  csv: "CSV",
  md: "Markdown",
  txt: "Plain Text",
};
export type Format = keyof typeof formats;
