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

type Column = Array<Accessor>;
export type Accessor = {
  id: string;
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
export type Cell = {
  id: string;
  value: null | number | string | boolean;
};

type Hash = { [id: string]: Primitive };

export function createFlat(fields: Array<Field>) {
  const heads = fieldsToHeads(fields);
  const columns = fieldsToColumns(fields);
  return {
    heads,
    columns,
    toRows(structs: Array<Struct>) {
      return structsToRows({ columns, structs });
    },
    toHashes(structs: Array<Struct>) {
      return structsToHashes({ columns, structs });
    },
  };
}
export type Flat = ReturnType<typeof createFlat>;

function fieldsToHeads(fields: Array<Field>): Array<Accessor> {
  return fields.flatMap((field) => {
    if (field.type === "STRUCT" || field.type === "RECORD") {
      return fieldsToHeads(field.fields).map((f) => ({
        ...f,
        id: `${field.name}.${f.name}`,
      }));
    }
    return {
      ...field,
      id: field.name,
    };
  });
}

function fieldsToColumns(fields: Array<Field>): Array<Column> {
  return fields.flatMap((field) => {
    if (field.type === "STRUCT" || field.type === "RECORD") {
      return fieldsToColumns(field.fields).map((columns) => [
        {
          ...field,
          id: field.name,
        },
        ...columns.map((column) => ({
          ...column,
          id: `${field.name}.${column.id}`,
        })),
      ]);
    }
    return [[{ ...field, id: field.name }]];
  });
}

function structsToRows({
  columns,
  structs,
}: {
  columns: Array<Column>;
  structs: Array<Struct>;
}): Array<Row> {
  return structs.flatMap((struct) => structToRows({ columns, struct }));
}

function structToRows({
  columns,
  struct,
}: {
  columns: Array<Column>;
  struct: Struct;
}): Array<Row> {
  const results: Array<Row> = [];
  const depths: Array<number> = new Array(columns.length).fill(0);
  columns.forEach((column, columnIndex) =>
    walk({
      struct,
      columnIndex,
      column,
      accessorIndex: 0,
      results,
      depths,
      fill: fillWithRow,
    })
  );
  return results;
}

function structsToHashes({
  columns,
  structs,
}: {
  columns: Array<Column>;
  structs: Array<Struct>;
}): Array<Hash> {
  return structs.flatMap((struct) => structToHashes({ columns, struct }));
}

function structToHashes({
  columns,
  struct,
}: {
  columns: Array<Column>;
  struct: Struct;
}): Array<Hash> {
  const hashes: Array<Hash> = [];
  const depths: Array<number> = new Array(columns.length).fill(0);
  columns.forEach((column, columnIndex) =>
    walk({
      struct,
      columnIndex,
      column,
      accessorIndex: 0,
      results: hashes,
      depths,
      fill: fillWithHash,
    })
  );
  return hashes;
}

function walk<T>({
  struct,
  columnIndex,
  column,
  accessorIndex,
  results,
  depths,
  fill,
}: {
  struct: Struct;
  columnIndex: number;
  column: Column;
  accessorIndex: number;
  results: Array<T>;
  depths: Array<number>;
  fill(props: {
    columnIndex: number;
    accessor: Accessor;
    results: Array<T>;
    depths: Array<number>;
    value: Primitive;
  }): void;
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
            results,
            depths,
            fill,
          });
        });
        break;
      }
      (s[accessor.name] as Array<Primitive>).forEach((value) =>
        fill({
          columnIndex,
          accessor,
          results: results,
          depths,
          value,
        })
      );
    } else {
      if (accessor.type === "STRUCT" || accessor.type === "RECORD") {
        s = s[accessor.name] as Struct;
        continue;
      }
      fill({
        columnIndex,
        accessor,
        results: results,
        depths,
        value: s[accessor.name] as Primitive,
      });
    }
  }
}

function fillWithRow({
  columnIndex,
  accessor,
  results,
  depths,
  value,
}: {
  columnIndex: number;
  accessor: Accessor;
  results: Array<Row>;
  depths: Array<number>;
  value: Primitive;
}) {
  if (!results[depths[columnIndex]!]) {
    results[depths[columnIndex]!] = [];
  }
  results[depths[columnIndex]!]![columnIndex] = {
    id: accessor.id,
    value: primitiveToCell(value),
  };
  depths[columnIndex]! += 1;
}

function fillWithHash({
  columnIndex,
  accessor,
  results,
  depths,
  value,
}: {
  columnIndex: number;
  accessor: Accessor;
  results: Array<Hash>;
  depths: Array<number>;
  value: Primitive;
}) {
  if (!results[depths[columnIndex]!]) {
    results[depths[columnIndex]!] = {};
  }
  results[depths[columnIndex]!]![accessor.id] = primitiveToCell(value);
  depths[columnIndex]! += 1;
}

function primitiveToCell(primitive: Primitive): Cell["value"] {
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
