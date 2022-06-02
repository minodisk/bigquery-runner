import { Writable } from "stream";
import { Flat, Formatter } from ".";
import { toSerializablePage } from "./bigquery";
import {
  CloseEvent,
  Data,
  Page,
  Metadata,
  OpenEvent,
  RowsEvent,
  Struct,
  Table,
  Routine,
} from "./types";

export type Output = Readonly<{
  open: () => Promise<string | void>;
  writeRoutine: (
    params: Readonly<{
      routine: Routine;
      metadata: Metadata;
    }>
  ) => Promise<unknown>;
  writeHeads: (
    params: Readonly<{
      flat: Flat;
    }>
  ) => Promise<unknown>;
  writeRows: (
    params: Readonly<{
      structs: Array<Struct>;
      flat: Flat;
      metadata: Metadata;
      table: Table;
      page: Page;
    }>
  ) => Promise<unknown>;
  close: () => Promise<void>;
  dispose: () => unknown;
}>;

export function createViewerOutput({
  postMessage,
}: {
  postMessage(message: unknown): Thenable<boolean>;
}): Output {
  return {
    async open() {
      await postMessage({
        source: "bigquery-runner",
        payload: {
          event: "open",
        },
      } as Data<OpenEvent>);
    },

    async writeRoutine(payload) {
      await postMessage({
        source: "bigquery-runner",
        payload: {
          event: "routine",
          payload,
        },
      });
    },

    async writeHeads() {
      // do nothing
    },

    async writeRows({ structs, flat, metadata, table, page }) {
      await postMessage({
        source: "bigquery-runner",
        payload: {
          event: "rows",
          payload: {
            header: flat.heads.map(({ id }) => id),
            rows: flat.toRows({
              structs,
              rowNumberStart: page.rowNumberStart,
            }),
            metadata,
            table,
            page: toSerializablePage(page),
          },
        },
      } as Data<RowsEvent>);
    },

    async close() {
      await postMessage({
        source: "bigquery-runner",
        payload: {
          event: "close",
        },
      } as Data<CloseEvent>);
    },

    dispose() {
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
    async writeRoutine() {
      // do nothing
    },
    async writeHeads({ flat }) {
      outputChannel.append(formatter.header({ flat }));
    },
    async writeRows({ structs, flat }) {
      outputChannel.append(
        await formatter.rows({ structs, rowNumberStart: 0n, flat })
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
    async writeRoutine() {
      // do nothing
    },
    async writeHeads({ flat }) {
      const res = formatter.header({ flat });
      if (res) {
        stream.write(res);
      }
    },
    async writeRows({ structs, flat }) {
      stream.write(await formatter.rows({ structs, rowNumberStart: 0n, flat }));
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
