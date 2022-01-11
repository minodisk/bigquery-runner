import * as CSV from "csv-stringify";
import EasyTable from "easy-table";
import { tenderize } from "tenderizer";
import { Accessor, Row } from ".";

export type Formatter = {
  header: (header: Array<Accessor>) => string;
  rows: (params: {
    header: Array<string>;
    rows: Array<Row>;
  }) => Promise<string>;
  footer: () => string;
};

export function createTableFormatter(): Formatter {
  return {
    header() {
      return "";
    },
    async rows({ rows }) {
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
    header(header) {
      return `|${header.join("|")}|
|${header.map(() => "---").join("|")}|
`;
    },
    async rows({ rows }) {
      const keys = new Set<string>();
      const rs = rows.flatMap((row) => {
        const ts = tenderize(row);
        ts.map((t) => {
          Object.keys(t).forEach((key) => {
            keys.add(key);
          });
        });
        return ts;
      });
      const ks = Array.from(keys);
      const m: Array<string> = rs.map(
        (r) =>
          `|${ks
            .map((key) => {
              if (!r[key]) {
                return "";
              }
              return `${r[key]}`.replace("\n", "<br/>");
            })
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
    header() {
      return "";
    },
    async rows({ rows }) {
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
    header() {
      return "[";
    },
    async rows({ rows }) {
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
    header() {
      return "";
    },
    async rows({ rows }) {
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
