import type { Options } from "csv-stringify";
import { stringify } from "csv-stringify";
import EasyTable from "easy-table";
import type { StructuralRow } from "types";
import type { Flat } from "./flat";

export type Formatter = Readonly<{
  head(props: Readonly<{ flat: Flat }>): void;
  body(
    props: Readonly<{
      flat: Flat;
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
    body({ structs }) {
      structs.forEach((struct) => {
        writer.write(JSON.stringify(struct));
        writer.write("\n");
      });
    },
    async foot() {
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
    body({ structs }) {
      structs.forEach((struct) => {
        if (!first) {
          writer.write(",");
        }
        writer.write(JSON.stringify(struct));
        first = false;
      });
    },
    async foot() {
      writer.write("]\n");
      return new Promise((resolve) => writer.end(resolve));
    },
  };
}

export function createCSVFormatter({
  writer,
  options,
}: {
  writer: NodeJS.WritableStream;
  options: Options;
}): Formatter {
  const stringifier = stringify(options);
  stringifier.pipe(writer);
  const promise = new Promise<void>((resolve, reject) => {
    stringifier.on("error", reject);
    stringifier.on("finish", () => resolve());
  });
  return {
    head() {
      // do nothing
    },
    body({ flat, structs }) {
      if (structs.length === 0) {
        return;
      }
      flat
        .toHashes({
          structs,
          transform: (p) => (p === null ? "" : `${p}`),
        })
        .forEach((hash) => stringifier.write(hash));
    },
    async foot() {
      stringifier.end();
      return promise;
    },
  };
}

export function createMarkdownFormatter({
  writer,
}: {
  writer: NodeJS.WritableStream;
}): Formatter {
  return {
    head({ flat }) {
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
    body({ flat, structs, rowNumberStart }) {
      flat.toRows({ structs, rowNumberStart }).forEach(({ rows }) =>
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
    async foot() {
      return new Promise((resolve) => writer.end(resolve));
    },
  };
}

export function createTableFormatter({
  writer,
}: {
  writer: NodeJS.WritableStream;
}): Formatter {
  return {
    head() {
      // do nothing
    },
    body({ flat, structs, rowNumberStart }) {
      const t = new EasyTable();
      flat.toRows({ structs, rowNumberStart }).forEach(({ rows }) => {
        rows.forEach((row) => {
          row.forEach((cell) => t.cell(cell.id, cell.value));
          t.newRow();
        });
      });
      writer.write(t.toString().trimEnd());
      writer.write("\n");
    },
    async foot() {
      return new Promise((resolve) => writer.end(resolve));
    },
  };
}
