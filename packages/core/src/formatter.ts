import * as CSV from "csv-stringify";
import EasyTable from "easy-table";
import { tenderize } from "tenderizer";
import { Accessor, Row } from "./flatten";

export type Formatter = {
  readonly type: "table" | "markdown" | "json-lines" | "json" | "csv";
  readonly header: (heads: Array<Accessor>) => string;
  readonly rows: (rows: Array<Row>) => Promise<string>;
  readonly footer: () => string;
};

export function createTableFormatter(): Formatter {
  return {
    type: "table",
    header() {
      return "";
    },
    async rows(rows) {
      const t = new EasyTable();
      rows.forEach((row) => {
        row.forEach((cell) => {
          t.cell(cell.id, cell.value);
        });
        t.newRow();
      });
      return t.toString().trimEnd() + "\n";
    },
    footer() {
      return "";
    },
  };
}

export function createMarkdownFormatter(): Formatter {
  return {
    type: "markdown",
    header(heads) {
      if (heads.length === 0) {
        return "";
      }
      return `|${heads.map(({ id }) => id).join("|")}|
|${heads.map(() => "---").join("|")}|
`;
    },
    async rows(rows) {
      const m: Array<string> = rows.map(
        (row) =>
          `|${row
            .map(({ value }) =>
              typeof value === "string"
                ? value.replace(/\n/g, "<br/>")
                : `${value}`
            )
            .join("|")}|`
      );
      return m.join("\n") + "\n";
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
    async rows(rows) {
      return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
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
    async rows(rows) {
      const prefix = len === 0 ? "" : ",";
      len += rows.length;
      return prefix + rows.map((row) => JSON.stringify(row)).join(",");
    },
    footer() {
      return "]\n";
    },
  };
}

export function createCSVFormatter(options: CSV.Options): Formatter {
  return {
    type: "csv",
    header() {
      return "";
    },
    async rows(rows) {
      const structs = rows.flatMap((row) => tenderize(row));
      return await new Promise<string>((resolve, reject) => {
        CSV.stringify(structs, options, (err?: Error, res?: string) => {
          if (err) {
            reject(err);
            return;
          }
          if (res) {
            resolve(res);
          }
        });
      });
    },
    footer() {
      return "";
    },
  };
}
