import * as CSV from "csv-stringify";
import EasyTable from "easy-table";
import { Flat, Struct } from ".";

export type Formatter = {
  readonly type: "table" | "markdown" | "json-lines" | "json" | "csv";
  readonly header: () => string;
  readonly rows: (props: {
    structs: Array<Struct>;
    rowNumber: number;
  }) => Promise<string>;
  readonly footer: () => string;
};

export function createTableFormatter({ flat }: { flat: Flat }): Formatter {
  return {
    type: "table",
    header() {
      return "";
    },
    async rows(props) {
      const t = new EasyTable();
      flat.toRows(props).forEach(({ rows }) => {
        rows.forEach((row) =>
          row.forEach((cell) => t.cell(cell.id, cell.value))
        );
        t.newRow();
      });
      return t.toString().trimEnd() + "\n";
    },
    footer() {
      return "";
    },
  };
}

export function createMarkdownFormatter({ flat }: { flat: Flat }): Formatter {
  return {
    type: "markdown",
    header() {
      if (flat.heads.length === 0) {
        return "";
      }
      return `|${flat.heads.map(({ id }) => id).join("|")}|
|${flat.heads.map(() => "---").join("|")}|
`;
    },
    async rows(props) {
      return (
        flat
          .toRows(props)
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
    footer() {
      return "";
    },
  };
}

export function createJSONLinesFormatter(): Formatter {
  return {
    type: "json-lines",
    header() {
      return "";
    },
    async rows({ structs }) {
      return (
        structs
          .flatMap(({ rows }) => rows)
          .map((row) => JSON.stringify(row))
          .join("\n") + "\n"
      );
    },
    footer() {
      return "";
    },
  };
}

export function createJSONFormatter(): Formatter {
  let len = 0;
  return {
    type: "json",
    header() {
      return "[";
    },
    async rows({ structs }) {
      const rows = structs.flatMap(({ rows }) => rows);
      const prefix = len === 0 ? "" : ",";
      len += rows.length;
      return prefix + rows.map((row) => JSON.stringify(row)).join(",");
    },
    footer() {
      return "]\n";
    },
  };
}

export function createCSVFormatter({
  flat,
  options,
}: {
  flat: Flat;
  options: CSV.Options;
}): Formatter {
  return {
    type: "csv",
    header() {
      return "";
    },
    async rows({ structs }) {
      const rows = structs.flatMap(({ rows }) => rows);
      if (rows.length === 0) {
        return "";
      }
      return await new Promise<string>((resolve, reject) => {
        CSV.stringify(
          flat.toHashes(rows),
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
    footer() {
      return "";
    },
  };
}
