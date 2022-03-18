/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { valueToPrimitive } from "./transform";
import {
  Accessor,
  Column,
  Field,
  Hash,
  NumberedRows,
  Value,
  Row,
  Struct,
  Primitive,
} from "./types";

type Transform = (primitive: Primitive) => Primitive;

export function createFlat(fields: Array<Field>) {
  const heads = fieldsToHeads(fields);
  const columns = fieldsToColumns(fields);
  return {
    heads,
    columns,
    toRows({
      structs,
      rowNumber,
      transform,
    }: {
      readonly structs: Array<Struct>;
      readonly rowNumber: number;
      readonly transform?: Transform;
    }) {
      return structsToRows({ heads, columns, structs, rowNumber, transform });
    },
    toHashes({
      structs,
      transform,
    }: {
      readonly structs: Array<Struct>;
      readonly transform?: Transform;
    }) {
      return structsToHashes({ columns, structs, transform });
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
  heads,
  columns,
  structs,
  rowNumber,
  transform,
}: {
  readonly heads: Array<Accessor>;
  readonly columns: Array<Column>;
  readonly structs: Array<Struct>;
  readonly rowNumber: number;
  readonly transform?: Transform;
}): Array<NumberedRows> {
  return structs.map((struct, i) => {
    const rows = structToRows({ heads, columns, struct, transform });
    return {
      rowNumber: rowNumber + i,
      rows,
    };
  });
}

function structToRows({
  heads,
  columns,
  struct,
  transform,
}: {
  readonly heads: Array<Accessor>;
  readonly columns: Array<Column>;
  readonly struct: Struct;
  readonly transform?: Transform;
}): Array<Row> {
  const rows: Array<Row> = [];
  const createFillWithRow = createFillWithRowCreator({
    heads,
    results: rows,
    depths: new Array(columns.length).fill(0),
    transform,
  });
  columns.forEach((column, columnIndex) =>
    walk({
      struct,
      column,
      accessorIndex: 0,
      fill: createFillWithRow({ columnIndex }),
    })
  );
  return rows;
}

function structsToHashes({
  columns,
  structs,
  transform,
}: {
  readonly columns: Array<Column>;
  readonly structs: Array<Struct>;
  readonly transform?: Transform;
}): Array<Hash> {
  return structs.flatMap((struct) =>
    structToHashes({ columns, struct, transform })
  );
}

function structToHashes({
  columns,
  struct,
  transform,
}: {
  readonly columns: Array<Column>;
  readonly struct: Struct;
  readonly transform?: Transform;
}): Array<Hash> {
  const results: Array<Hash> = [];
  const createFillWithHash = createFillWithHashCreator({
    results,
    depths: new Array(columns.length).fill(0),
    transform,
  });
  columns.forEach((column, columnIndex) =>
    walk({
      struct,
      column,
      accessorIndex: 0,
      fill: createFillWithHash({ columnIndex }),
    })
  );
  return results;
}

function walk({
  struct,
  column,
  accessorIndex,
  fill,
}: {
  readonly struct: Struct;
  readonly column: Column;
  readonly accessorIndex: number;
  fill(props: { accessor: Accessor; value: Value }): void;
}): void {
  let s: Struct = struct;
  let isNull = false;
  for (let ai = accessorIndex; ai < column.length; ai += 1) {
    const accessor = column[ai]!;
    if (accessor.mode === "REPEATED") {
      if (accessor.type === "STRUCT" || accessor.type === "RECORD") {
        (s[accessor.name] as Array<Struct>).forEach((struct) => {
          walk({
            struct,
            column,
            accessorIndex: ai + 1,
            fill,
          });
        });
        break;
      }
      (s[accessor.name] as Array<Value>).forEach((value) =>
        fill({
          accessor,
          value,
        })
      );
    } else {
      if (accessor.type === "STRUCT" || accessor.type === "RECORD") {
        if (!isNull) {
          s = s[accessor.name] as Struct;
          isNull = s === null;
        }
        continue;
      }
      fill({
        accessor,
        value: isNull ? null : (s[accessor.name] as Value),
      });
    }
  }
}

function createFillWithRowCreator({
  heads,
  results,
  depths,
  transform = (primitive) => primitive,
}: {
  readonly heads: Array<Accessor>;
  readonly results: Array<Row>;
  readonly depths: Array<number>;
  readonly transform?: Transform;
}) {
  return ({ columnIndex }: { columnIndex: number }) => {
    return ({ accessor, value }: { value: Value; accessor: Accessor }) => {
      if (!results[depths[columnIndex]!]) {
        results[depths[columnIndex]!] = heads.map(({ id }) => ({
          id,
          value: undefined,
        }));
      }
      results[depths[columnIndex]!]![columnIndex] = {
        id: accessor.id,
        value: transform(valueToPrimitive(value)),
      };
      depths[columnIndex]! += 1;
    };
  };
}

function createFillWithHashCreator({
  results,
  depths,
  transform = (primitive) => primitive,
}: {
  readonly results: Array<Hash>;
  readonly depths: Array<number>;
  readonly transform?: Transform;
}) {
  return ({ columnIndex }: { columnIndex: number }) => {
    return ({ value, accessor }: { value: Value; accessor: Accessor }) => {
      if (!results[depths[columnIndex]!]) {
        results[depths[columnIndex]!] = {};
      }
      results[depths[columnIndex]!]![accessor.id] = transform(
        valueToPrimitive(value)
      );
      depths[columnIndex]! += 1;
    };
  };
}
