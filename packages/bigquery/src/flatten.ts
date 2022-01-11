import {
  BigQueryDate,
  BigQueryDatetime,
  BigQueryInt,
  BigQueryTime,
  BigQueryTimestamp,
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
type PrimitiveFieldType = typeof primitiveTableFieldTypes[number];
const structTableFieldTypes = ["RECORD", "STRUCT"] as const;
type StructFieldType = typeof structTableFieldTypes[number];

export type FieldMode = "NULLABLE" | "REQUIRED" | "REPEATED";

export type Head = {
  name: string;
  type: FieldType;
  mode: FieldMode;
};

export type Struct = {
  [name: string]: Primitive | Struct | Array<Primitive | Struct>;
};
export type Primitive =
  | null
  | number
  | string
  | boolean
  | BigQueryDate
  | BigQueryDatetime
  | BigQueryInt
  | BigQueryTime
  | BigQueryTimestamp;

export type Row = Array<Cell>;
export type Cell = null | number | string | boolean;

export function fieldsToHeads(fields?: Array<Field>): Array<Head> {
  if (!fields) {
    return [];
  }
  return fields.flatMap((field) => {
    if (field.type === "STRUCT" || field.type === "RECORD") {
      return fieldsToHeads(field.fields).map((f) => ({
        name: `${field.name}.${f.name}`,
        type: f.type,
        mode: f.mode,
      }));
    }
    return field;
  });
}

type Column = Array<Accessor>;
type Accessor = Field & { rowIndex: number };

function filedsToColumns(fields: Array<Field>): Array<Column> {
  return fields.flatMap((field) => {
    if (field.type === "STRUCT" || field.type === "RECORD") {
      return filedsToColumns(field.fields).map((fs) => [
        { ...field, rowIndex: 0 },
        ...fs,
      ]);
    }
    return [[{ ...field, rowIndex: 0 }]];
  });
}

export function structsToRows({
  fields,
  structs,
}: {
  fields: Array<Field>;
  structs: Array<Struct>;
}): Array<Row> {
  return structs.flatMap((struct) => structToRows({ fields, struct }));
}

export function structToRows({
  fields,
  struct,
}: {
  fields: Array<Field>;
  struct: Struct;
}): Array<Row> {
  const columns = filedsToColumns(fields);
  const rows: Array<Row> = [];
  columns.forEach((column, columnIndex) =>
    walk({
      struct,
      columnIndex,
      column,
      accessorIndex: 0,
      rows,
    })
  );
  return rows;
}

function walk({
  struct,
  columnIndex,
  column,
  accessorIndex,
  rows,
}: {
  struct: Struct;
  columnIndex: number;
  column: Column;
  accessorIndex: number;
  rows: Array<Row>;
}): void {
  let s: Struct = struct;
  for (let ai = accessorIndex; ai < column.length; ai += 1) {
    const accessor = column[ai]!;
    if (accessor.mode === "REPEATED") {
      if (accessor.type === "STRUCT" || accessor.type === "RECORD") {
        (s[accessor.name] as Array<Struct>).forEach((struct) => {
          walk({
            struct,
            columnIndex,
            column,
            accessorIndex: ai + 1,
            rows,
          });
        });
        break;
      }
      (s[accessor.name] as Array<Primitive>).forEach((v) => {
        if (!rows[accessor.rowIndex]) {
          rows[accessor.rowIndex] = [];
        }
        rows[accessor.rowIndex]![columnIndex] = primitiveToCell(v);
        accessor.rowIndex += 1;
      });
    } else {
      if (!rows[accessor.rowIndex]) {
        rows[accessor.rowIndex] = [];
      }
      if (accessor.type === "STRUCT" || accessor.type === "RECORD") {
        s = s[accessor.name] as Struct;
        continue;
      }
      rows[accessor.rowIndex]![columnIndex] = primitiveToCell(
        s[accessor.name] as Primitive
      );
      accessor.rowIndex += 1;
    }
  }
}

function primitiveToCell(primitive: Primitive): Cell {
  if (
    primitive === null ||
    typeof primitive === "number" ||
    typeof primitive === "string" ||
    typeof primitive === "boolean"
  ) {
    return primitive;
  }
  return primitive.value;
}
