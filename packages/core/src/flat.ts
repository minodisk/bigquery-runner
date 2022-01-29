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
} from "./types";

export function createFlat(fields: Array<Field>) {
  const heads = fieldsToHeads(fields);
  const columns = fieldsToColumns(fields);
  return {
    heads,
    columns,
    toRows({
      structs,
      rowNumber,
    }: {
      structs: Array<Struct>;
      rowNumber: number;
    }) {
      return structsToRows({ heads, columns, structs, rowNumber });
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
  heads,
  columns,
  structs,
  rowNumber,
}: {
  readonly heads: Array<Accessor>;
  readonly columns: Array<Column>;
  readonly structs: Array<Struct>;
  readonly rowNumber: number;
}): Array<NumberedRows> {
  return structs.map((struct, i) => {
    const rows = structToRows({ heads, columns, struct });
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
}: {
  readonly heads: Array<Accessor>;
  readonly columns: Array<Column>;
  readonly struct: Struct;
}): Array<Row> {
  const rows: Array<Row> = [];
  const createFillWithRow = createFillWithRowCreator({
    heads,
    results: rows,
    depths: new Array(columns.length).fill(0),
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
  const results: Array<Hash> = [];
  const createFillWithHash = createFillWithHashCreator({
    results,
    depths: new Array(columns.length).fill(0),
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
  struct: Struct;
  column: Column;
  accessorIndex: number;
  fill(props: { accessor: Accessor; value: Value }): void;
}): void {
  let s: Struct = struct;
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
        s = s[accessor.name] as Struct;
        continue;
      }
      fill({
        accessor,
        value: s[accessor.name] as Value,
      });
    }
  }
}

function createFillWithRowCreator({
  heads,
  results,
  depths,
}: {
  heads: Array<Accessor>;
  results: Array<Row>;
  depths: Array<number>;
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
        value: valueToPrimitive(value),
      };
      depths[columnIndex]! += 1;
    };
  };
}

function createFillWithHashCreator({
  results,
  depths,
}: {
  results: Array<Hash>;
  depths: Array<number>;
}) {
  return ({ columnIndex }: { columnIndex: number }) => {
    return ({ value, accessor }: { value: Value; accessor: Accessor }) => {
      if (!results[depths[columnIndex]!]) {
        results[depths[columnIndex]!] = {};
      }
      results[depths[columnIndex]!]![accessor.id] = valueToPrimitive(value);
      depths[columnIndex]! += 1;
    };
  };
}
