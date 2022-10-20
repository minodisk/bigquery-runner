/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type {
  Accessor,
  Column,
  Field,
  NumberedRows,
  Value,
  Row,
  StructuralRow,
} from "shared";
import { valueToPrimitive } from "./transform";

export type Flat = Readonly<{
  heads: ReadonlyArray<Accessor>;
  getNumberedRows(
    props: Readonly<{
      structs: ReadonlyArray<StructuralRow>;
      rowNumberStart: bigint;
    }>
  ): ReadonlyArray<NumberedRows>;
}>;

export function createFlat(fields: ReadonlyArray<Field>): Flat {
  const heads = fieldsToHeads(fields, []);
  const columns = fieldsToColumns(fields);
  return {
    heads,
    getNumberedRows({ structs, rowNumberStart }) {
      return structs.map((struct, i) => {
        const rows = structToRows({ heads, columns, struct });
        return {
          rowNumber: `${rowNumberStart + BigInt(i)}`,
          rows,
        };
      });
    },
  };
}

function fieldsToHeads(
  fields: ReadonlyArray<Field>,
  names: Array<string>
): ReadonlyArray<Accessor> {
  return fields.flatMap((field) => {
    if (field.type === "STRUCT" || field.type === "RECORD") {
      return fieldsToHeads(field.fields, [...names, field.name]);
    }
    return {
      ...field,
      id: [...names, field.name].join("."),
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

function structToRows({
  heads,
  columns,
  struct,
}: Readonly<{
  heads: ReadonlyArray<Accessor>;
  columns: ReadonlyArray<Column>;
  struct: StructuralRow;
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
        value: valueToPrimitive(value),
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
