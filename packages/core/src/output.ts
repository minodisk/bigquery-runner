import { createWriteStream, WriteStream } from "fs";
import mkdirp from "mkdirp";
import { basename, extname, join } from "path";
import { Flat, Formatter, Results } from ".";

export type Output = {
  readonly open: () => Promise<string | void>;
  readonly path: () => string | void;
  readonly writeHeads: (props: { readonly flat: Flat }) => Promise<unknown>;
  readonly writeRows: (
    results: Results & {
      readonly flat: Flat;
      readonly numRows: string;
    }
  ) => Promise<unknown>;
  readonly bytesWritten: () => Promise<number | void>;
  readonly close: () => Promise<void>;
  readonly dispose: () => unknown;
};

export type WebviewPanel = {
  readonly webview: {
    html: string;
    postMessage(message: unknown): Thenable<boolean>;
  };
  dispose(): unknown;
  onDidDispose(
    callback: () => void,
    hoge: unknown,
    subscriptions: Array<{ dispose(): unknown }>
  ): void;
};

let panel: WebviewPanel | undefined;

export function createViewerOutput({
  html,
  subscriptions,
  createWebviewPanel,
}: {
  readonly html: string;
  readonly subscriptions: Array<{ dispose(): unknown }>;
  createWebviewPanel(): WebviewPanel;
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
          event: "open",
        },
      });
    },
    path() {
      return "";
    },
    async writeHeads() {
      // do nothing
    },
    async writeRows({ rows, page, flat, numRows }) {
      if (!panel) {
        throw new Error(`panel is not initialized`);
      }
      return panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "rows",
          payload: {
            header: flat.heads.map(({ id }) => id),
            rows: flat.toRows({
              structs: rows,
              rowNumber: page ? page.rowsPerPage * page.current + 1 : 1,
            }),
            page: page,
            numRows: numRows,
          },
        },
      });
    },
    async bytesWritten() {
      // do nothing
    },
    async close() {
      if (!panel) {
        return;
      }
      panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "close",
        },
      });
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
    path() {
      // do nothing
    },
    async writeHeads({ flat }) {
      outputChannel.append(formatter.header({ flat }));
    },
    async writeRows({ rows, flat }) {
      outputChannel.append(
        await formatter.rows({ structs: rows, rowNumber: 0, flat })
      );
    },
    async bytesWritten() {
      // do nothing
    },
    async close() {
      outputChannel.append(formatter.footer());
    },
    async dispose() {
      // do nothing
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
    path() {
      // do nothing
    },
    async writeHeads({ flat }) {
      const res = formatter.header({ flat });
      if (res) {
        stream.write(res);
      }
    },
    async writeRows({ rows, flat }) {
      stream.write(await formatter.rows({ structs: rows, rowNumber: 0, flat }));
    },
    async bytesWritten() {
      stream.write(formatter.footer());
      await new Promise((resolve, reject) => {
        stream.on("error", reject).on("finish", resolve).end();
      });
      return stream.bytesWritten;
    },
    async close() {
      // do nothing
    },
    async dispose() {
      stream.end();
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
