import {
  BigQueryDate,
  BigQueryDatetime,
  BigQueryInt,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
} from "@google-cloud/bigquery";

export type Field = PrimitiveField | StructField;
export type PrimitiveField = {
  name: string;
  type: PrimitiveFieldType;
  mode: FieldMode;
};
export type StructField = {
  name: string;
  type: StructFieldType;
  mode: FieldMode;
  fields: Array<Field>;
};

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

export type Column = Array<Accessor>;
export type Accessor = {
  id: string;
  name: string;
  type: FieldType;
  mode: FieldMode;
};

export type Struct = {
  [name: string]: Value | Struct | Array<Value | Struct>;
};
export type Value =
  | null
  | number
  | string
  | boolean
  | BigInt
  | Buffer
  | Geography
  | BigQueryDate
  | BigQueryDatetime
  | BigQueryInt
  | BigQueryTime
  | BigQueryTimestamp;

export type Primitive = null | number | string | boolean;

export type NumberedRows = {
  rowNumber: string;
  rows: Array<Row>;
};

export type Row = Array<Cell>;
export type Cell = {
  id: string;
  value?: Primitive;
};

export type Hash = { [id: string]: Value };

export type Data<E extends Event> = {
  source: "bigquery-runner";
  payload: E;
};

export function isData(data: { source?: string }): data is Data<Event> {
  return data.source === "bigquery-runner";
}

export type Event = FocusedEvent | OpenEvent | CloseEvent | RowsEvent;

export type FocusedEvent = {
  event: "focused";
  payload: {
    focused: boolean;
  };
};
export function isFocusedEvent(e: Event): e is FocusedEvent {
  return e.event === "focused";
}

export type OpenEvent = {
  event: "open";
  payload: undefined;
};
export function isOpenEvent(e: Event): e is OpenEvent {
  return e.event === "open";
}

export type CloseEvent = {
  event: "close";
  payload: undefined;
};
export function isCloseEvent(e: Event): e is CloseEvent {
  return e.event === "close";
}

export type RowsEvent = {
  event: "rows";
  payload: Rows;
};
export type Rows = {
  header: Array<string>;
  rows: Array<NumberedRows>;
  jobInfo: JobInfo;
  tableInfo: TableInfo;
  edgeInfo: SerializableEdgeInfo;
};
export function isRowsEvent(e: Event): e is RowsEvent {
  return e.event === "rows";
}

export type RunInfo = {
  jobInfo: JobInfo;
  tableInfo: TableInfo;
  edgeInfo: EdgeInfo;
};

export type JobInfo = Readonly<{
  kind: string;
  etag: string;
  id: string;
  selfLink: string;
  configuration: Readonly<{
    query: Readonly<{
      query: string;
      destinationTable: TableReference;
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
    totalBytesProcessed: string;
    query: {
      totalBytesProcessed: string;
      totalBytesBilled: string;
      cacheHit: boolean;
      statementType: string;
    };
  }>;
  status: Readonly<{
    state: string;
  }>;
  user_email: string;
}>;

export type TableInfo = Readonly<{
  creationTime: string;
  etag: string;
  expirationTime: string;
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

export type Schema = Readonly<{
  fields?: Array<Field>;
}>;

export type TableReference = Readonly<{
  projectId: string;
  datasetId: string;
  tableId: string;
}>;

export type EdgeInfo = {
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
  readonly rowNumberStart: bigint;
  readonly rowNumberEnd: bigint;
};

export type SerializableEdgeInfo = {
  readonly hasPrev: boolean;
  readonly hasNext: boolean;
  readonly rowNumberStart: string;
  readonly rowNumberEnd: string;
};

// export type Results = {
//   readonly structs: Array<Struct>;
//   readonly page: Page;
// };

// export type Page = {
//   readonly maxResults?: number;
//   readonly current: number;
// };

export type ViewerEvent = StartEvent | EndEvent | PrevEvent | NextEvent;
export type StartEvent = {
  event: "start";
};
export type EndEvent = {
  event: "end";
};
export type PrevEvent = {
  event: "prev";
};
export type NextEvent = {
  event: "next";
};

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
