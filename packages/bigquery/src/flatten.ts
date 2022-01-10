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

export type Header = {
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
}): Array<Row> {
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
}): Array<Row> {
  const accessorsList = fieldsToAccessorsList(fields);
  const rows: Array<Row> = [];
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
  rows: Array<Row>;
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
      (val[accessor.name] as Array<Primitive>).forEach((v) => {
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

function cast(value: Primitive): Cell {
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
