import type {
  BigQueryDate,
  BigQueryDatetime,
  BigQueryInt,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
} from "@google-cloud/bigquery";
import { Error } from "./error";

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

export type Struct = Readonly<{
  [name: string]: Value | Struct | ReadonlyArray<Value | Struct>;
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

export function isData(data: { source?: string }): data is Data<RendererEvent> {
  return data.source === "bigquery-runner";
}

export type RendererEvent =
  | FocusedEvent
  | StartProcessingEvent
  | MetadataEvent
  | TableEvent
  | RoutineEvent
  | RowsEvent
  | SuccessProcessingEvent
  | FailProcessingEvent;

export type FocusedEvent = Readonly<{
  event: "focused";
  payload: {
    focused: boolean;
  };
}>;
export function isFocusedEvent(e: RendererEvent): e is FocusedEvent {
  return e.event === "focused";
}

export type StartProcessingEvent = Readonly<{
  event: "startProcessing";
}>;
export function isStartProcessingEvent(
  e: RendererEvent
): e is StartProcessingEvent {
  return e.event === "startProcessing";
}

export type MetadataEvent = Readonly<{
  event: "metadata";
  payload: MetadataPayload;
}>;
export type MetadataPayload = {
  metadata: Metadata;
};
export function isMetadataEvent(e: RendererEvent): e is MetadataEvent {
  return e.event === "metadata";
}

export type TableEvent = Readonly<{
  event: "table";
  payload: TablePayload;
}>;
export type TablePayload = {
  table: Table;
};
export function isTableEvent(e: RendererEvent): e is TableEvent {
  return e.event === "table";
}

export type RoutineEvent = Readonly<{
  event: "routine";
  payload: RoutinePayload;
}>;
export type RoutinePayload = {
  routine: Routine;
};
export function isRoutineEvent(e: RendererEvent): e is RoutineEvent {
  return e.event === "routine";
}

export type RowsEvent = Readonly<{
  event: "rows";
  payload: RowsPayload;
}>;
export type RowsPayload = Readonly<{
  header: ReadonlyArray<string>;
  rows: ReadonlyArray<NumberedRows>;
  page: SerializablePage;
}>;
export function isRowsEvent(e: RendererEvent): e is RowsEvent {
  return e.event === "rows";
}

export type SuccessProcessingEvent = Readonly<{
  event: "successProcessing";
}>;
export function isSuccessLoadingEvent(
  e: RendererEvent
): e is SuccessProcessingEvent {
  return e.event === "successProcessing";
}

export type FailProcessingEvent = Readonly<{
  event: "failProcessing";
  payload: Error<string>;
}>;
export function isFailProcessingEvent(
  e: RendererEvent
): e is FailProcessingEvent {
  return e.event === "failProcessing";
}

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
  jobReference: Readonly<{
    projectId: string;
    jobId: string;
    location: string;
  }>;
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
  baseUrl: string;
  id: string;
  metadata: {
    creationTime: string;
    definitionBody: string;
    etag: string;
    language: "SQL";
    lastModifiedTime: string;
    routineReference: {
      datasetId: string;
      projectId: string;
      routineId: string;
    };
    routineType: "PROCEDURE";
  };
}>;

export type Schema = Readonly<{
  fields?: ReadonlyArray<Field>;
}>;

export type TableReference = Readonly<{
  projectId: string;
  datasetId: string;
  tableId: string;
}>;

export type Page = Readonly<{
  hasPrev: boolean;
  hasNext: boolean;
  rowNumberStart: bigint;
  rowNumberEnd: bigint;
  numRows: bigint;
}>;

export type SerializablePage = Readonly<{
  hasPrev: boolean;
  hasNext: boolean;
  rowNumberStart: string;
  rowNumberEnd: string;
  numRows: string;
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

export function isLoadedEvent(e: ViewerEvent): e is StartEvent {
  return e.event === "loaded";
}
export function isStartEvent(e: ViewerEvent): e is StartEvent {
  return e.event === "start";
}
export function isEndEvent(e: ViewerEvent): e is EndEvent {
  return e.event === "end";
}
export function isPrevEvent(e: ViewerEvent): e is PrevEvent {
  return e.event === "prev";
}
export function isNextEvent(e: ViewerEvent): e is NextEvent {
  return e.event === "next";
}
export function isDownloadEvent(e: ViewerEvent): e is DownloadEvent {
  return e.event === "download";
}
export function isPreviewEvent(e: ViewerEvent): e is PreviewEvent {
  return e.event === "preview";
}

export const formats = {
  jsonl: "JSON Lines",
  json: "JSON",
  csv: "CSV",
  md: "Markdown",
  txt: "Plain Text",
};
export type Format = keyof typeof formats;
