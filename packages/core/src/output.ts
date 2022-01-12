import { createWriteStream, WriteStream } from "fs";
import mkdirp from "mkdirp";
import { basename, extname, join } from "path";
import { Accessor, Cell, Row } from "./flatten";
import { Formatter } from "./formatter";

export type Output = {
  readonly open: () => Promise<string | void>;
  readonly path: () => string | void;
  readonly writeHeads: (heads: Array<Accessor>) => Promise<unknown>;
  readonly writeRows: (rows: Array<Row>) => Promise<unknown>;
  readonly close: () => Promise<number | void>;
};

export type WebviewPanel = {
  readonly webview: {
    html: string;
    postMessage(message: any): Thenable<boolean>;
  };
  onDidDispose(
    callback: () => void,
    hoge: any,
    subscriptions: Array<{ dispose(): any }>
  ): void;
};

export function createViewerOutput({
  html,
  subscriptions,
  createWebviewPanel,
}: {
  readonly html: string;
  readonly subscriptions: Array<{ dispose(): any }>;
  createWebviewPanel(): WebviewPanel;
}): Output {
  let panel: WebviewPanel | undefined;
  return {
    async open() {
      if (!panel) {
        panel = createWebviewPanel();
        panel.webview.html = html;
        panel.onDidDispose(
          () => {
            panel = undefined;
          },
          null,
          subscriptions
        );
      }

      await panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "clear",
        },
      });
    },
    path() {
      return "";
    },
    async writeHeads(heads) {
      if (!panel) {
        throw new Error(`panel is not initialized`);
      }
      return panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "header",
          payload: heads.map(({ id }) => id),
        },
      });
    },
    async writeRows(rows) {
      if (!panel) {
        throw new Error(`panel is not initialized`);
      }
      return panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "rows",
          payload: rows.map((row) =>
            row.reduce<{ [accessor: string]: Cell["value"] }>((obj, cell) => {
              if (cell) {
                obj[cell.id] = cell.value;
              }
              return obj;
            }, {})
          ),
        },
      });
    },
    async close() {
      // do nothing
    },
  };
}

export function createLogOutput({
  formatter,
  outputChannel,
}: {
  readonly formatter: Formatter;
  readonly outputChannel: {
    show(preserveFocus: boolean): void;
    append(value: string): void;
  };
}): Output {
  return {
    async open() {
      outputChannel.show(true);
    },
    path() {},
    async writeHeads(heads) {
      outputChannel.append(formatter.header(heads));
    },
    async writeRows(rows) {
      outputChannel.append(await formatter.rows(rows));
    },
    async close() {
      outputChannel.append(formatter.footer());
    },
  };
}

export function createFileOutput({
  formatter,
  dirname,
  filename,
}: {
  readonly formatter: Formatter;
  readonly dirname: string;
  readonly filename: string;
}): Output {
  let stream: WriteStream;
  return {
    async open() {
      await mkdirp(dirname);
      const path = join(
        dirname,
        `${basename(filename, extname(filename))}${formatToExtension(
          formatter.type
        )}`
      );
      stream = createWriteStream(path);
      return path;
    },
    path() {},
    async writeHeads(heads) {
      const res = formatter.header(heads);
      if (res) {
        stream.write(res);
      }
    },
    async writeRows(rows) {
      stream.write(await formatter.rows(rows));
    },
    async close() {
      stream.write(formatter.footer());
      await new Promise((resolve, reject) => {
        stream.on("error", reject).on("finish", resolve).end();
      });
      return stream.bytesWritten;
    },
  };
}

function formatToExtension(format: Formatter["type"]): string {
  return {
    table: ".txt",
    markdown: ".md",
    "json-lines": ".jsonl",
    json: ".json",
    csv: ".csv",
  }[format];
}
