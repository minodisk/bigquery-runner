import type { Options } from "csv-stringify";
import { stringify } from "csv-stringify";
import EasyTable from "easy-table";
import type { StructuralRow } from "shared";
import type { Flat } from "./flat";

export type Formatter = Readonly<{
  head(): void;
  body(
    props: Readonly<{
      structs: ReadonlyArray<StructuralRow>;
      rowNumberStart: bigint;
    }>
  ): void;
  foot(): Promise<void>;
}>;

export function createJSONLinesFormatter({
  writer,
}: {
  writer: NodeJS.WritableStream;
}): Formatter {
  return {
    head() {
      // do nothing
    },
    body({
      structs,
    }: Readonly<{
      structs: ReadonlyArray<StructuralRow>;
    }>) {
      structs.forEach((struct) => {
        writer.write(JSON.stringify(struct));
        writer.write("\n");
      });
    },
    async foot(): Promise<void> {
      return new Promise((resolve) => writer.end(resolve));
    },
  };
}

export function createJSONFormatter({
  writer,
}: {
  writer: NodeJS.WritableStream;
}): Formatter {
  let first = true;
  return {
    head() {
      writer.write("[");
    },
    body({
      structs,
    }: Readonly<{
      structs: ReadonlyArray<StructuralRow>;
    }>) {
      structs.forEach((struct) => {
        if (!first) {
          writer.write(",");
        }
        writer.write(JSON.stringify(struct));
        first = false;
      });
    },
    async foot(): Promise<void> {
      writer.write("]\n");
      return new Promise((resolve) => writer.end(resolve));
    },
  };
}

export function createCSVFormatter({
  flat,
  writer,
  options,
}: {
  flat: Flat;
  writer: NodeJS.WritableStream;
  options: Options;
}): Formatter {
  const stringifier = stringify(
    options.header
      ? { ...options, columns: flat.heads.map(({ id }) => id) }
      : options
  );
  stringifier.pipe(writer);
  const promise = new Promise<void>((resolve, reject) => {
    stringifier.on("error", reject);
    stringifier.on("finish", () => resolve());
  });
  return {
    head() {
      // do nothing
    },
    body({ structs, rowNumberStart }) {
      if (structs.length === 0) {
        return;
      }
      flat.getNumberedRows({ structs, rowNumberStart }).forEach(({ rows }) =>
        rows.forEach((row) => {
          stringifier.write(
            row.map(({ value }) =>
              value === null || value === undefined ? "" : `${value}`
            )
          );
        })
      );
    },
    async foot() {
      stringifier.end();
      return promise;
    },
  };
}

export function createMarkdownFormatter({
  flat,
  writer,
}: {
  flat: Flat;
  writer: NodeJS.WritableStream;
}): Formatter {
  return {
    head() {
      if (flat.heads.length === 0) {
        return;
      }
      writer.write(`|`);
      flat.heads.forEach(({ id }) => writer.write(`${id}|`));
      writer.write(`\n`);
      writer.write(`|`);
      flat.heads.forEach(() => writer.write("---|"));
      writer.write(`\n`);
    },
    body({
      structs,
      rowNumberStart,
    }: Readonly<{
      structs: ReadonlyArray<StructuralRow>;
      rowNumberStart: bigint;
    }>) {
      flat.getNumberedRows({ structs, rowNumberStart }).forEach(({ rows }) =>
        rows.forEach((row) => {
          writer.write(`|`);
          row.forEach(({ value }) => {
            if (value === undefined) {
              writer.write("|");
              return;
            }
            if (typeof value !== "string") {
              writer.write(`${value}|`);
              return;
            }
            writer.write(value.replace(/\n/g, "<br/>"));
            writer.write("|");
          });
          writer.write(`\n`);
        })
      );
    },
    async foot(): Promise<void> {
      return new Promise((resolve) => writer.end(resolve));
    },
  };
}

export function createTableFormatter({
  flat,
  writer,
}: {
  flat: Flat;
  writer: NodeJS.WritableStream;
}): Formatter {
  return {
    head() {
      // do nothing
    },
    body({
      structs,
      rowNumberStart,
    }: Readonly<{
      structs: ReadonlyArray<StructuralRow>;
      rowNumberStart: bigint;
    }>) {
      const t = new EasyTable();
      flat.getNumberedRows({ structs, rowNumberStart }).forEach(({ rows }) => {
        rows.forEach((row) => {
          row.forEach((cell) => t.cell(cell.id, cell.value));
          t.newRow();
        });
      });
      writer.write(t.toString().trimEnd());
      writer.write("\n");
    },
    async foot(): Promise<void> {
      return new Promise((resolve) => writer.end(resolve));
    },
  };
}
