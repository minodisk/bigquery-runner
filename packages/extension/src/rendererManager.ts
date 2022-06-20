import { format } from "bytes";
import { createFlat, Flat, toSerializablePage } from "core";
import {
  CloseEvent,
  Data,
  Metadata,
  OpenEvent,
  Page,
  RoutinePayload,
  RowsEvent,
  Struct,
  Table,
} from "types";
import { OutputChannel, ViewColumn } from "vscode";
import { PanelManager } from "./panelManager";
import { ErrorWithId, RunJobResponse } from "./runner";
import { StatusManager } from "./statusManager";

export type RendererManager = ReturnType<typeof createRendererManager>;

export type Renderer = Awaited<ReturnType<RendererManager["create"]>>;

export function createRendererManager({
  outputChannel,
  statusManager,
  panelManager,
}: Readonly<{
  outputChannel: OutputChannel;
  statusManager: StatusManager;
  panelManager: PanelManager;
}>) {
  return {
    async create({
      fileName,
      viewColumn,
    }: {
      readonly fileName: string;
      readonly viewColumn?: ViewColumn;
    }) {
      const panel = await panelManager.create({
        fileName,
        viewColumn,
      });

      async function writeRoutine(payload: RoutinePayload) {
        await panel.webview.postMessage({
          source: "bigquery-runner",
          payload: {
            event: "routine",
            payload,
          },
        });
      }

      async function writeRows({
        structs,
        flat,
        metadata,
        table,
        page,
      }: {
        structs: Array<Struct>;
        flat: Flat;
        metadata: Metadata;
        table: Table;
        page: Page;
      }) {
        await panel.webview.postMessage({
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
      }

      return {
        async open() {
          await panel.webview.postMessage({
            source: "bigquery-runner",
            payload: {
              event: "open",
            },
          } as Data<OpenEvent>);
        },

        async render({
          fileName,
          response,
        }: Readonly<{
          fileName: string;
          response: RunJobResponse;
        }>) {
          if (response.type === "routine") {
            const { metadata, routine } = response;
            writeRoutine({
              routine,
              metadata,
            });
            return;
          }
          try {
            const { metadata, structs, table, page } = response;

            statusManager.loadBilled({ fileName });

            outputChannel.appendLine(`Result: ${structs.length} rows`);
            const bytes = format(
              parseInt(metadata.statistics.query.totalBytesBilled, 10)
            );
            outputChannel.appendLine(
              `Result: ${bytes} to be billed (cache: ${metadata.statistics.query.cacheHit})`
            );

            if (table.schema.fields === undefined) {
              throw new Error("fields is not defined");
            }

            const flat = createFlat(table.schema.fields);
            await writeRows({
              structs,
              flat,
              metadata,
              table,
              page,
            });

            statusManager.succeedBilled({
              fileName,
              billed: { bytes, cacheHit: metadata.statistics.query.cacheHit },
            });
          } catch (err) {
            statusManager.errorBilled({ fileName });
            if (response.jobId) {
              throw new ErrorWithId(err, response.jobId);
            } else {
              throw err;
            }
          }
        },

        async close() {
          await panel.webview.postMessage({
            source: "bigquery-runner",
            payload: {
              event: "close",
            },
          } as Data<CloseEvent>);
        },
      };
    },

    dispose() {
      // do nothing
    },
  };
}

// function formatToExtension(format: Formatter["type"]): string {
//   return {
//     table: ".txt",
//     markdown: ".md",
//     "json-lines": ".jsonl",
//     json: ".json",
//     csv: ".csv",
//   }[format];
// }

// function createFormatter({ config }: { config: Config }): Formatter {
//   switch (config.format.type) {
//     case "table":
//       return createTableFormatter();
//     case "markdown":
//       return createMarkdownFormatter();
//     case "json-lines":
//       return createJSONLinesFormatter();
//     case "json":
//       return createJSONFormatter();
//     case "csv":
//       return createCSVFormatter({ options: config.format.csv });
//     default:
//       throw new Error(`Invalid format: ${config.format.type}`);
//   }
// }
