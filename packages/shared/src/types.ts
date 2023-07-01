import type {
  BigQueryDate,
  BigQueryDatetime,
  BigQueryInt,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
} from "@google-cloud/bigquery";
import type { Err } from ".";

export type RunnerID = `${"file" | "query"}://${string}`;

export type Field = PrimitiveField | StructField;
export type PrimitiveField = Readonly<{
  name: string;
  type: PrimitiveFieldType;
  mode?: FieldMode;
}>;
export type StructField = Readonly<{
  name: string;
  type: StructFieldType;
  mode?: FieldMode;
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
  "GEOGRAPHY",
  "JSON",
] as const;
export type PrimitiveFieldType = (typeof primitiveTableFieldTypes)[number];

const structTableFieldTypes = ["RECORD", "STRUCT"] as const;
export type StructFieldType = (typeof structTableFieldTypes)[number];

export type FieldMode = "NULLABLE" | "REQUIRED" | "REPEATED";

export type Column = ReadonlyArray<Accessor>;
export type Accessor = Readonly<{
  id: string;
  name: string;
  type: FieldType;
  mode?: FieldMode;
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
  | TablesEvent
  | RoutinesEvent
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

export type TablesEvent = Readonly<{
  event: "tables";
  payload: ReadonlyArray<TablePayload>;
}>;
export type TablePayload = {
  id: string;
  heads: ReadonlyArray<Accessor>;
  table: Table;
};

export type RoutinesEvent = Readonly<{
  event: "routines";
  payload: ReadonlyArray<RoutinePayload>;
}>;
export type RoutinePayload = {
  id: string;
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

export const tabs = ["Rows", "Table", "Routine", "Job"] as const;
export type Tab = (typeof tabs)[number];

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
    jobType: "QUERY";
    query: Readonly<{
      defaultDataset: DatasetReference;
      destinationTable?: TableReference;
      priority: "INTERACTIVE";
      query: string;
      writeDisposition?: string;
      useLegacySql: boolean;
    }>;
  }>;
  jobReference: JobReference;
  statistics: JobStatistics;
  status: Readonly<{
    state: string;
  }>;
  user_email: string;
}>;
export type JobStatisticsBase = Readonly<{
  creationTime: string;
  endTime: string;
  startTime: string;
  totalBytesProcessed: string;
  totalSlotMs: string;
}>;
export type JobStandaloneStatistics = JobStatisticsBase &
  Readonly<{
    query: Readonly<{
      billingTier: number;
      cacheHit: boolean;
      estimatedBytesProcessed: string;
      statementType: StatementType;
      totalBytesBilled: string;
      totalBytesProcessed: string;
      totalPartitionsProcessed: string;
      totalSlotMs: string;
    }>;
  }>;
export type JobHasChildrenStatistics = JobStatisticsBase &
  Readonly<{
    numChildJobs: string;
    query: Readonly<{
      statementType: StatementType;
      totalBytesBilled: string;
      totalBytesProcessed: string;
      totalSlotMs: string;
    }>;
  }>;
export type JobStatistics = JobStandaloneStatistics | JobHasChildrenStatistics;

export type ChildJob = Readonly<{
  baseUrl: string;
  id: string;
  metadata: {
    id: string;
    jobReference: JobReference;
    kind: "bigquery#job";
    state: "DONE";
    statistics: Readonly<{
      creationTime: string;
      endTime: string;
      query: ChildQuery;
      startTime: string;
      totalBytesProcessed: string;
    }>;
    status: {
      state: "DONE";
    };
  };
}>;
export type ChildQueryBase = Readonly<{
  billingTier: number;
  cacheHit: boolean;
  totalBytesBilled: string;
  totalBytesProcessed: string;
  totalPartitionsProcessed: string;
}>;
export type ChildDmlQuery = ChildQueryBase &
  Readonly<{
    dmlStats: Readonly<{
      deletedRowCount: string;
      insertedRowCount: string;
      updatedRowCount: string;
    }>;
    numDmlAffectedRows: string;
    referencedTables: ReadonlyArray<TableReference>;
  }>;
export type ChildDdlTableQuery = ChildQueryBase &
  Readonly<{
    ddlTargetTable: TableReference;
    schema: ReadonlyArray<Field>;
  }>;
export type ChildDdlRoutineQuery = ChildQueryBase &
  Readonly<{
    ddlTargetRoutine: RoutineReference;
  }>;
export type ChildQuery =
  | ChildDmlQuery
  | ChildDdlTableQuery
  | ChildDdlRoutineQuery;

export type JobReference = Readonly<{
  projectId: ProjectID;
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

export type Schema = Readonly<{
  fields: ReadonlyArray<Field>;
}>;

export type ProjectID = string;
export type DatasetID = string;
export type TableID = string;
export type FieldID = string;
export type RoutineID = string;

export type ProjectReference = Readonly<{
  projectId: ProjectID;
}>;

export type DatasetReference = Readonly<{
  projectId: ProjectID;
  datasetId: DatasetID;
}>;

export type TableReference = Readonly<{
  projectId: ProjectID;
  datasetId: DatasetID;
  tableId: TableID;
}>;

export type FieldReference = Readonly<{
  projectId: ProjectID;
  datasetId: DatasetID;
  tableId: TableID;
  fieldId: FieldID;
  name: string;
  type?: FieldType;
  mode?: FieldMode;
  fields?: Array<FieldReference>;
}>;

export type RoutineReference = Readonly<{
  projectId: ProjectID;
  datasetId: DatasetID;
  routineId: RoutineID;
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
  payload: {
    tableReference: TableReference;
  };
}>;

export const formats = {
  jsonl: "JSON Lines",
  json: "JSON",
  csv: "CSV",
  md: "Markdown",
  txt: "Plain Text",
};
export type Format = keyof typeof formats;

export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };

// export type NamedParamKey = {
//   // type: "named";
//   name: string;
//   token: `@${string}`;
//   ranges: ReadonlyArray<Range>;
// };
// export type PositionalParamKey = {
//   // type: "positional";
//   // token: "?";
//   // index: number;
//   range: Range;
// };
// export type NamedParamKeys = {
//   type: "named";
//   keys: Array<NamedParamKey>;
// };
// export const isNamedParamKeys = (keys: ParamKeys): keys is NamedParamKeys =>
//   keys.type === "named";
// export type PositionalParamKeys = {
//   type: "positional";
//   keys: Array<PositionalParamKey>;
// };
// export const isPositionalParamKeys = (
//   keys: ParamKeys
// ): keys is PositionalParamKeys => keys.type === "positional";
// export type ParamKeys = NamedParamKeys | PositionalParamKeys;

// export type NamedParamValue = { name: string; value: unknown };
// export type PositionalParamValue = { value: unknown };
// export type NamedParamValues = {
//   type: "named";
//   values: ReadonlyArray<NamedParamValue>;
// };
// export const isNamedParamValues = (
//   values: ParamValues
// ): values is NamedParamValues => values.type === "named";
// export type PositionalParamValues = {
//   type: "positional";
//   values: ReadonlyArray<PositionalParamValue>;
// };
// export const isPositionalParamValues = (
//   values: ParamValues
// ): values is PositionalParamValues => values.type === "positional";
// export type ParamValues = NamedParamValues | PositionalParamValues;
