import { readFile } from "fs/promises";
import { join } from "path";
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
  Table,
  tryCatch,
  ViewerEvent,
  UnknownError,
  RunnerID,
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

export type RendererManager = Readonly<{
  get(
    props: Readonly<{
      runnerId: RunnerID;
      title: string;
      viewColumn?: ViewColumn;
    }>
  ): Promise<Result<UnknownError, Renderer>>;
  dispose(): void;
}>;

export type Renderer = {
  disposed: boolean;

  readonly runnerId: RunnerID;
  readonly viewColumn: ViewColumn;
  readonly reveal: () => void;
  readonly startLoading: () => Promise<Result<UnknownError, void>>;
  readonly cancelLoading: () => Promise<Result<UnknownError, void>>;

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

  readonly dispose: () => void;
};

export function createRendererManager({
  ctx,
  configManager,
  outputChannel,
  onPrevPageRequested,
  onNextPageRequested,
  onDownloadRequested,
  onPreviewRequested,
  onDidDisposePanel,
}: Readonly<{
  ctx: ExtensionContext;
  configManager: ConfigManager;
  outputChannel: OutputChannel;
  onPrevPageRequested: (renderer: Renderer) => unknown;
  onNextPageRequested: (renderer: Renderer) => unknown;
  onDownloadRequested: (renderer: Renderer) => unknown;
  onPreviewRequested: (renderer: Renderer) => unknown;
  onDidDisposePanel: (renderer: Renderer) => unknown;
}>): RendererManager {
  const renderers = new Map<RunnerID, Renderer>();

  return {
    get({ runnerId, title, viewColumn: baseViewColumn }) {
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
            disposed: false,

            runnerId,

            viewColumn,

            reveal() {
              panel.reveal(undefined, true);
            },

            startLoading() {
              return postMessage({
                event: "open",
              });
            },

            cancelLoading() {
              return postMessage({
                event: "close",
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

            renderRows({ structs, table, page }) {
              return tryCatch(
                async () => {
                  outputChannel.appendLine(`Result: ${structs.length} rows`);

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
                },
                (reason) => {
                  return {
                    type: "Unknown",
                    reason: String(reason),
                  };
                }
              );
            },

            dispose() {
              this.disposed = true;
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

    dispose() {
      renderers.clear();
    },
  };
}
