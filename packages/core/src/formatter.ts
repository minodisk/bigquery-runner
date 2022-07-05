import * as CSV from "csv-stringify";
import EasyTable from "easy-table";
import { Hash, Struct } from "types";
import { Flat } from "./flat";

export type Formatter = Readonly<{
  head(props: Readonly<{ flat: Flat }>): string;
  body(
    props: Readonly<{
      flat: Flat;
      structs: ReadonlyArray<Struct>;
      rowNumberStart: bigint;
    }>
  ): Promise<string>;
  foot(): string;
}>;

export function createTableFormatter(): Formatter {
  return {
    head() {
      return "";
    },
    async body({ flat, structs, rowNumberStart }) {
      const t = new EasyTable();
      flat.toRows({ structs, rowNumberStart }).forEach(({ rows }) => {
        rows.forEach((row) => {
          row.forEach((cell) => t.cell(cell.id, cell.value));
          t.newRow();
        });
      });
      return t.toString().trimEnd() + "\n";
    },
    foot() {
      return "";
    },
  };
}

export function createMarkdownFormatter(): Formatter {
  return {
    head({ flat }) {
      if (flat.heads.length === 0) {
        return "";
      }
      return `|${flat.heads.map(({ id }) => id).join("|")}|
|${flat.heads.map(() => "---").join("|")}|
`;
    },
    async body({ flat, structs, rowNumberStart }) {
      return (
        flat
          .toRows({ structs, rowNumberStart })
          .flatMap(({ rows }) =>
            rows.map(
              (row) =>
                `|${row
                  .map(({ value }) =>
                    value === undefined
                      ? ""
                      : typeof value === "string"
                      ? value.replace(/\n/g, "<br/>")
                      : `${value}`
                  )
                  .join("|")}|`
            )
          )
          .join("\n") + "\n"
      );
    },
    foot() {
      return "";
    },
  };
}

export function createJSONLinesFormatter(): Formatter {
  return {
    head() {
      return "";
    },
    async body({ structs }) {
      return structs.map((struct) => JSON.stringify(struct)).join("\n") + "\n";
    },
    foot() {
      return "";
    },
  };
}

export function createJSONFormatter(): Formatter {
  let len = 0;
  return {
    head() {
      return "[";
    },
    async body({ structs }) {
      const prefix = len === 0 ? "" : ",";
      len += structs.length;
      return prefix + structs.map((struct) => JSON.stringify(struct)).join(",");
    },
    foot() {
      return "]\n";
    },
  };
}

export function createCSVFormatter(options: CSV.Options): Formatter {
  return {
    head() {
      return "";
    },
    async body({ flat, structs }) {
      if (structs.length === 0) {
        return "";
      }
      return await new Promise<string>((resolve, reject) => {
        CSV.stringify(
          flat.toHashes({
            structs,
            transform: (p) => (p === null ? "" : `${p}`),
          }) as Array<Hash>,
          options,
          (err?: Error, res?: string) => {
            if (err) {
              reject(err);
              return;
            }
            if (res) {
              resolve(res);
            }
          }
        );
      });
    },
    foot() {
      return "";
    },
  };
}
