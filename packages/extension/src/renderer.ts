import { readFile } from "fs/promises";
import { basename, join } from "path";
import { format } from "bytes";
import { createFlat, toSerializablePage } from "core";
import {
  CloseEvent,
  Data,
  FocusedEvent,
  isDownloadEvent,
  isLoadedEvent,
  isNextEvent,
  isPrevEvent,
  isPreviewEvent,
  OpenEvent,
  RowsEvent,
  ViewerEvent,
} from "types";
import {
  ExtensionContext,
  OutputChannel,
  Uri,
  ViewColumn,
  WebviewPanel,
  window,
} from "vscode";
import { ConfigManager } from "./configManager";
import { ErrorWithId, RunJobResponse } from "./runner";
import { StatusManager } from "./statusManager";

export type RendererManager = ReturnType<typeof createRendererManager>;

export type Renderer = {
  reveal: () => void;
  open: () => Promise<void>;
  render: (
    props: Readonly<{
      fileName: string;
      response: RunJobResponse;
    }>
  ) => Promise<void>;
  error: () => void;
  close: () => Promise<void>;
};

export function createRendererManager({
  ctx,
  configManager,
  outputChannel,
  statusManager,
  onPrevPageRequested,
  onNextPageRequested,
  onDownloadRequested,
  onPreviewRequested,
  onDidDisposePanel,
}: Readonly<{
  ctx: ExtensionContext;
  configManager: ConfigManager;
  outputChannel: OutputChannel;
  statusManager: StatusManager;
  onPrevPageRequested: (e: {
    fileName: string;
    panel: WebviewPanel;
  }) => unknown;
  onNextPageRequested: (e: {
    fileName: string;
    panel: WebviewPanel;
  }) => unknown;
  onDownloadRequested: (e: {
    fileName: string;
    panel: WebviewPanel;
  }) => unknown;
  onPreviewRequested: (e: { fileName: string; panel: WebviewPanel }) => unknown;
  onDidDisposePanel: (e: { readonly fileName: string }) => unknown;
}>) {
  const map: Map<string, Renderer> = new Map();

  return {
    async create({
      fileName,
      viewColumn,
    }: {
      readonly fileName: string;
      readonly viewColumn?: ViewColumn;
    }): Promise<Renderer> {
      {
        const renderer = map.get(fileName);
        if (renderer) {
          renderer.reveal();
          return renderer;
        }
      }

      const config = configManager.get();
      const column = config.viewer.column;
      let panelViewColumn: ViewColumn;
      if (typeof column === "number") {
        panelViewColumn = column;
      } else if (viewColumn !== undefined) {
        panelViewColumn = viewColumn + parseInt(column, 10);
      } else {
        panelViewColumn = ViewColumn.Active;
      }

      const root = join(ctx.extensionPath, "out/viewer");
      const base = Uri.file(root)
        .with({
          scheme: "vscode-resource",
        })
        .toString();
      const html = (await readFile(join(root, "index.html"), "utf-8")).replace(
        "<head>",
        `<head><base href="${base}/" />`
      );

      const panel = await new Promise<WebviewPanel>((resolve) => {
        let resolved = false;

        const panel = window.createWebviewPanel(
          `bigqueryRunner:${fileName}`,
          basename(fileName),
          {
            viewColumn: panelViewColumn,
            preserveFocus: true,
          },
          {
            enableScripts: true,
            localResourceRoots: [Uri.file(root)],
          }
        );
        ctx.subscriptions.push(panel);

        panel.onDidChangeViewState((e) =>
          panel.webview.postMessage({
            source: "bigquery-runner",
            payload: {
              event: "focused",
              payload: {
                focused: e.webviewPanel.active,
              },
            },
          } as Data<FocusedEvent>)
        );
        panel.onDidDispose(() => {
          onDidDisposePanel({ fileName });
        });
        panel.iconPath = Uri.file(
          join(ctx.extensionPath, "out/assets/icon-small.png")
        );

        panel.webview.onDidReceiveMessage(async (event: ViewerEvent) => {
          if (isLoadedEvent(event) && !resolved) {
            resolved = true;
            resolve(panel);
          } else if (isPrevEvent(event)) {
            onPrevPageRequested({ fileName, panel });
          } else if (isNextEvent(event)) {
            onNextPageRequested({ fileName, panel });
          } else if (isDownloadEvent(event)) {
            onDownloadRequested({ fileName, panel });
          } else if (isPreviewEvent(event)) {
            onPreviewRequested({ fileName, panel });
          }
        });
        panel.webview.html = html;
      });

      const renderer = {
        reveal() {
          panel.reveal(undefined, true);
        },

        async open() {
          statusManager.loadBilled({ fileName });
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
            await panel.webview.postMessage({
              source: "bigquery-runner",
              payload: {
                event: "routine",
                payload: {
                  routine,
                  metadata,
                },
              },
            });
            return;
          }
          try {
            const { metadata, structs, table, page } = response;

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

        error() {
          statusManager.errorBilled({ fileName });
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

      map.set(fileName, renderer);
      return renderer;
    },

    exists({ fileName }: Readonly<{ fileName: string }>) {
      return map.has(fileName);
    },

    delete({ fileName }: Readonly<{ readonly fileName: string }>) {
      return map.delete(fileName);
    },

    dispose() {
      map.clear();
    },
  };
}
