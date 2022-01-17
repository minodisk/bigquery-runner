import { createWriteStream, WriteStream } from "fs";
import mkdirp from "mkdirp";
import { basename, extname, join } from "path";
import { Flat, Formatter, Results } from ".";

export type Output = {
  readonly open: () => Promise<string | void>;
  readonly path: () => string | void;
  readonly writeHeads: () => Promise<unknown>;
  readonly writeRows: (
    results: Results & { numRows: string }
  ) => Promise<unknown>;
  readonly close: () => Promise<number | void>;
  readonly dispose: () => unknown;
};

export type WebviewPanel = {
  readonly webview: {
    html: string;
    postMessage(message: any): Thenable<boolean>;
  };
  dispose(): unknown;
  onDidDispose(
    callback: () => void,
    hoge: any,
    subscriptions: Array<{ dispose(): any }>
  ): void;
};

let panel: WebviewPanel | undefined;

export function createViewerOutput({
  html,
  subscriptions,
  createWebviewPanel,
  flat,
}: {
  readonly html: string;
  readonly subscriptions: Array<{ dispose(): any }>;
  createWebviewPanel(): WebviewPanel;
  readonly flat: Flat;
}): Output {
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
    async writeHeads() {
      if (!panel) {
        throw new Error(`panel is not initialized`);
      }
      return panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "header",
          payload: flat.heads.map(({ id }) => id),
        },
      });
    },
    async writeRows(results) {
      if (!panel) {
        throw new Error(`panel is not initialized`);
      }
      return panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "rows",
          payload: {
            rows: flat.toRows({
              structs: results.rows,
              rowNumber: results.page
                ? results.page.rowsPerPage * results.page.current + 1
                : 1,
            }),
            page: results.page,
            numRows: results.numRows,
          },
        },
      });
    },
    async close() {
      // do nothing
    },
    dispose() {
      if (!panel) {
        return;
      }
      return panel.dispose();
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
    async writeHeads() {
      outputChannel.append(formatter.header());
    },
    async writeRows(results) {
      outputChannel.append(await formatter.rows(results.rows));
    },
    async close() {
      outputChannel.append(formatter.footer());
    },
    async dispose() {},
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
    async writeHeads() {
      const res = formatter.header();
      if (res) {
        stream.write(res);
      }
    },
    async writeRows(results) {
      stream.write(await formatter.rows(results.rows));
    },
    async close() {
      stream.write(formatter.footer());
      await new Promise((resolve, reject) => {
        stream.on("error", reject).on("finish", resolve).end();
      });
      return stream.bytesWritten;
    },
    async dispose() {
      stream.end();
      stream = undefined!;
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
