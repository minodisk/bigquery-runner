import { createWriteStream, WriteStream } from "fs";
import mkdirp from "mkdirp";
import { basename, extname, join } from "path";
import { Flat, Struct } from ".";
import { Formatter } from "./formatter";

export type Output = {
  readonly open: () => Promise<string | void>;
  readonly path: () => string | void;
  readonly writeHeads: () => Promise<unknown>;
  readonly writeRows: (rows: Array<Struct>) => Promise<unknown>;
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
  flat,
}: {
  readonly html: string;
  readonly subscriptions: Array<{ dispose(): any }>;
  createWebviewPanel(): WebviewPanel;
  readonly flat: Flat;
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
    async writeRows(rows) {
      if (!panel) {
        throw new Error(`panel is not initialized`);
      }
      return panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "rows",
          payload: flat.toHashes(rows),
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
    async writeHeads() {
      outputChannel.append(formatter.header());
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
    async writeHeads() {
      const res = formatter.header();
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
