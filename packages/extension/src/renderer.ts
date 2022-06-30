import { readFile } from "fs/promises";
import { join } from "path";
import { format } from "bytes";
import { createFlat, toSerializablePage } from "core";
import {
  type Error,
  isDownloadEvent,
  isLoadedEvent,
  isNextEvent,
  isPrevEvent,
  isPreviewEvent,
  Metadata,
  RendererEvent,
  Result,
  Routine,
  RunnerID,
  Table,
  tryCatch,
  ViewerEvent,
  UnknownError,
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
import { SelectResponse } from "./runner";
import { StatusManager } from "./statusManager";

export type RendererManager = Readonly<{
  create(
    props: Readonly<{
      runnerId: RunnerID;
      title: string;
      baseViewColumn?: ViewColumn;
    }>
  ): Promise<Result<UnknownError, Renderer>>;
  exists(runnerId: RunnerID): boolean;
  dispose(): void;
}>;

export type Renderer = {
  readonly runnerId: RunnerID;
  readonly viewColumn: ViewColumn;
  readonly reveal: () => void;
  readonly open: () => Promise<Result<UnknownError, void>>;

  readonly renderMetadata: (
    metadata: Metadata
  ) => Promise<Result<UnknownError, void>>;
  readonly renderRoutine: (
    routine: Routine
  ) => Promise<Result<UnknownError, void>>;
  readonly renderTable: (table: Table) => Promise<Result<UnknownError, void>>;
  readonly renderRows: (
    data: SelectResponse
  ) => Promise<Result<UnknownError, void>>;

  readonly error: () => void;
  readonly close: () => Promise<Result<UnknownError, void>>;
  readonly dispose: () => void;
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
  onPrevPageRequested: (renderer: Renderer) => unknown;
  onNextPageRequested: (renderer: Renderer) => unknown;
  onDownloadRequested: (renderer: Renderer) => unknown;
  onPreviewRequested: (renderer: Renderer) => unknown;
  onDidDisposePanel: (renderer: Renderer) => unknown;
}>): RendererManager {
  const renderers = new Map<RunnerID, Renderer>();

  return {
    create({ runnerId, title, baseViewColumn }) {
      return tryCatch(
        async () => {
          const r = renderers.get(runnerId);
          if (r) {
            return r;
          }

          const {
            viewer: { column },
          } = configManager.get();
          let viewColumn: ViewColumn;
          if (typeof column === "number") {
            viewColumn = column;
          } else if (baseViewColumn !== undefined) {
            viewColumn = baseViewColumn + parseInt(column, 10);
          } else {
            viewColumn = ViewColumn.Active;
          }

          const root = join(ctx.extensionPath, "out/viewer");
          const base = Uri.file(root)
            .with({
              scheme: "vscode-resource",
            })
            .toString();
          const html = (
            await readFile(join(root, "index.html"), "utf-8")
          ).replace("<head>", `<head><base href="${base}/" />`);

          const postMessage = (
            event: RendererEvent
          ): Promise<Result<UnknownError, void>> => {
            return tryCatch(
              async () => {
                await panel.webview.postMessage({
                  source: "bigquery-runner",
                  payload: event,
                });
              },
              (err) => ({
                type: "Unknown",
                reason: String(err),
              })
            );
          };

          const panel = await new Promise<WebviewPanel>((resolve) => {
            let resolved = false;

            const panel = window.createWebviewPanel(
              `bigqueryRunner:${runnerId}`,
              title,
              {
                viewColumn,
                preserveFocus: true,
              },
              {
                enableScripts: true,
                localResourceRoots: [Uri.file(root)],
              }
            );
            ctx.subscriptions.push(panel);

            // panel.onDidChangeViewState((e) =>
            //   postMessage({
            //     event: "focused",
            //     payload: {
            //       focused: e.webviewPanel.active,
            //     },
            //   })
            // );
            panel.onDidDispose(() => {
              renderer.dispose();
            });
            panel.iconPath = Uri.file(
              join(ctx.extensionPath, "out/assets/icon-small.png")
            );

            panel.webview.onDidReceiveMessage(async (event: ViewerEvent) => {
              if (isLoadedEvent(event) && !resolved) {
                resolved = true;
                resolve(panel);
              } else if (isPrevEvent(event)) {
                onPrevPageRequested(renderer);
              } else if (isNextEvent(event)) {
                onNextPageRequested(renderer);
              } else if (isDownloadEvent(event)) {
                onDownloadRequested(renderer);
              } else if (isPreviewEvent(event)) {
                onPreviewRequested(renderer);
              }
            });
            panel.webview.html = html;
          });

          const renderer: Renderer = {
            runnerId,

            viewColumn,

            reveal() {
              panel.reveal(undefined, true);
            },

            open() {
              statusManager.loadBilled({ fileName: runnerId });
              return postMessage({
                event: "open",
              });
            },

            renderMetadata(metadata) {
              return postMessage({
                event: "metadata",
                payload: {
                  metadata,
                },
              });
            },

            renderRoutine(routine) {
              return postMessage({
                event: "routine",
                payload: {
                  routine,
                },
              });
            },

            renderTable(table) {
              return postMessage({
                event: "table",
                payload: {
                  table,
                },
              });
            },

            renderRows({ metadata, structs, table, page }) {
              return tryCatch(
                async () => {
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
                  await postMessage({
                    event: "rows",
                    payload: {
                      header: flat.heads.map(({ id }) => id),
                      rows: flat.toRows({
                        structs,
                        rowNumberStart: page.rowNumberStart,
                      }),
                      page: toSerializablePage(page),
                    },
                  });

                  statusManager.succeedBilled({
                    fileName: runnerId,
                    billed: {
                      bytes,
                      cacheHit: metadata.statistics.query.cacheHit,
                    },
                  });
                },
                (reason) => {
                  statusManager.errorBilled({ fileName: runnerId });
                  return {
                    type: "Unknown",
                    reason: String(reason),
                  };
                }
              );
            },

            error() {
              statusManager.errorBilled({ fileName: runnerId });
            },

            close() {
              return postMessage({
                event: "close",
              });
            },

            dispose() {
              renderers.delete(runnerId);
              onDidDisposePanel(this);
            },
          };

          renderers.set(runnerId, renderer);
          return renderer;
        },
        (err) => ({
          type: "Unknown",
          reason: String(err),
        })
      );
    },

    exists(runnerId) {
      return renderers.has(runnerId);
    },

    dispose() {
      renderers.clear();
    },
  };
}
