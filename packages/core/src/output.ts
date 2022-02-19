import { Writable } from "stream";
import { Flat, Formatter } from ".";
import { CloseEvent, Data, OpenEvent, Results, RowsEvent } from "./types";

export type Output = {
  readonly open: () => Promise<string | void>;
  readonly writeHeads: (props: { readonly flat: Flat }) => Promise<unknown>;
  readonly writeRows: (
    results: Results & {
      readonly flat: Flat;
      readonly numRows: string;
    }
  ) => Promise<unknown>;
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

export function createViewerOutput({
  createWebviewPanel,
}: {
  createWebviewPanel(onDidDispose: () => unknown): Promise<WebviewPanel>;
}): Output {
  let panel: WebviewPanel | undefined;
  return {
    async open() {
      if (!panel) {
        panel = await createWebviewPanel(() => {
          panel = undefined;
        });
      }

      await panel.webview.postMessage({
        source: "bigquery-runner",
        payload: {
          event: "open",
        },
      } as Data<OpenEvent>);
    },
    async writeHeads() {
      // do nothing
    },
    async writeRows({ structs, page, flat, numRows }) {
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
              structs,
              rowNumber: page ? page.rowsPerPage * page.current + 1 : 1,
            }),
            page,
            numRows,
          },
        },
      } as Data<RowsEvent>);
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
      } as Data<CloseEvent>);
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
    async writeHeads({ flat }) {
      outputChannel.append(formatter.header({ flat }));
    },
    async writeRows({ structs: rows, flat }) {
      outputChannel.append(
        await formatter.rows({ structs: rows, rowNumber: 0, flat })
      );
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
  stream,
}: {
  readonly formatter: Formatter;
  readonly stream: Writable;
}): Output {
  return {
    async open() {
      // do nothing
    },
    async writeHeads({ flat }) {
      const res = formatter.header({ flat });
      if (res) {
        stream.write(res);
      }
    },
    async writeRows({ structs: rows, flat }) {
      stream.write(await formatter.rows({ structs: rows, rowNumber: 0, flat }));
    },
    async close() {
      stream.write(formatter.footer());
      await new Promise((resolve, reject) => {
        stream.on("error", reject).on("finish", resolve).end();
      });
    },
    async dispose() {
      stream.end();
    },
  };
}
