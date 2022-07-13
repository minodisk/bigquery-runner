/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type {
  Accessor,
  Column,
  Field,
  NumberedRows,
  Value,
  Row,
  StructuralRow,
  Primitive,
  Result,
  UnknownError,
} from "types";
import { errorToString, tryCatchSync } from "types";
import { valueToPrimitive } from "./transform";

type Transform = (primitive: Primitive) => Primitive;

export type Flat = Readonly<{
  heads: ReadonlyArray<Accessor>;
  columns: ReadonlyArray<Column>;
  toRows(
    props: Readonly<{
      structs: ReadonlyArray<StructuralRow>;
      rowNumberStart: bigint;
      transform?: Transform;
    }>
  ): ReadonlyArray<NumberedRows>;
}>;

export function createFlat(
  fields: ReadonlyArray<Field>
): Result<UnknownError, Flat> {
  return tryCatchSync(
    () => {
      const heads = fieldsToHeads(fields);
      const columns = fieldsToColumns(fields);
      return {
        heads,
        columns,
        toRows({ structs, rowNumberStart, transform }) {
          return structsToRows({
            heads,
            columns,
            structs,
            rowNumberStart,
            transform,
          });
        },
      };
    },
    (err) => ({
      type: "Unknown" as const,
      reason: errorToString(err),
    })
  );
}

function fieldsToHeads(fields: ReadonlyArray<Field>): ReadonlyArray<Accessor> {
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

function fieldsToColumns(fields: ReadonlyArray<Field>): ReadonlyArray<Column> {
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
  rowNumberStart,
  transform,
}: Readonly<{
  heads: ReadonlyArray<Accessor>;
  columns: ReadonlyArray<Column>;
  structs: ReadonlyArray<StructuralRow>;
  rowNumberStart: bigint;
  transform?: Transform;
}>): ReadonlyArray<NumberedRows> {
  return structs.map((struct, i) => {
    const rows = structToRows({ heads, columns, struct, transform });
    return {
      rowNumber: `${rowNumberStart + BigInt(i)}`,
      rows,
    };
  });
}

function structToRows({
  heads,
  columns,
  struct,
  transform = (primitive) => primitive,
}: Readonly<{
  heads: ReadonlyArray<Accessor>;
  columns: ReadonlyArray<Column>;
  struct: StructuralRow;
  transform?: Transform;
}>): ReadonlyArray<Row> {
  const rows: Array<Row> = [];
  const depths = new Array(columns.length).fill(0);
  const createFillWithRow = ({ columnIndex }: { columnIndex: number }) => {
    return ({ accessor, value }: { value: Value; accessor: Accessor }) => {
      if (!rows[depths[columnIndex]!]) {
        rows[depths[columnIndex]!] = heads.map(({ id }) => ({
          id,
          value: undefined,
        }));
      }
      rows[depths[columnIndex]!]![columnIndex] = {
        id: accessor.id,
        value: transform(valueToPrimitive(value)),
      };
      depths[columnIndex]! += 1;
    };
  };

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

// function structsToHashes({
//   columns,
//   structs,
//   transform,
// }: Readonly<{
//   columns: ReadonlyArray<Column>;
//   structs: ReadonlyArray<StructuralRow>;
//   transform?: Transform;
// }>): ReadonlyArray<Hash> {
//   return structs.flatMap((struct) =>
//     structToHashes({ columns, struct, transform })
//   );
// }

// function structToHashes({
//   columns,
//   struct,
//   transform = (primitive) => primitive,
// }: Readonly<{
//   columns: ReadonlyArray<Column>;
//   struct: StructuralRow;
//   transform?: Transform;
// }>): ReadonlyArray<Hash> {
//   const results: Array<Hash> = [];
//   const depths = new Array(columns.length).fill(0);
//   const createFillWithHash = ({ columnIndex }: { columnIndex: number }) => {
//     return ({ value, accessor }: { value: Value; accessor: Accessor }) => {
//       if (!results[depths[columnIndex]!]) {
//         results[depths[columnIndex]!] = {};
//       }
//       results[depths[columnIndex]!]![accessor.id] = transform(
//         valueToPrimitive(value)
//       );
//       depths[columnIndex]! += 1;
//     };
//   };

//   columns.forEach((column, columnIndex) =>
//     walk({
//       struct,
//       column,
//       accessorIndex: 0,
//       fill: createFillWithHash({ columnIndex }),
//     })
//   );

//   return results;
// }

function walk({
  struct,
  column,
  accessorIndex,
  fill,
}: Readonly<{
  struct: StructuralRow;
  column: Column;
  accessorIndex: number;
  fill(props: { accessor: Accessor; value: Value }): void;
}>): void {
  let s: StructuralRow = struct;
  let isNull = false;
  for (let ai = accessorIndex; ai < column.length; ai += 1) {
    const accessor = column[ai]!;
    if (accessor.mode === "REPEATED") {
      if (accessor.type === "STRUCT" || accessor.type === "RECORD") {
        (s[accessor.name] as ReadonlyArray<StructuralRow>).forEach((struct) => {
          walk({
            struct,
            column,
            accessorIndex: ai + 1,
            fill,
          });
        });
        break;
      }
      (s[accessor.name] as ReadonlyArray<Value>).forEach((value) =>
        fill({
          accessor,
          value,
        })
      );
    } else {
      if (accessor.type === "STRUCT" || accessor.type === "RECORD") {
        if (!isNull) {
          s = s[accessor.name] as StructuralRow;
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
