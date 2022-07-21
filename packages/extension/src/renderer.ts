import { readFile } from "fs/promises";
import { join } from "path";
import { createFlat, toSerializablePage } from "core";
import type {
  Metadata,
  Result,
  Routine,
  Table,
  ViewerEvent,
  UnknownError,
  RunnerID,
  RendererEvent,
  Err,
  PrevEvent,
  NextEvent,
  DownloadEvent,
  PreviewEvent,
  Accessor,
  Tab,
} from "types";
import {
  isDownloadEvent,
  isLoadedEvent,
  isNextEvent,
  isPrevEvent,
  isPreviewEvent,
  tryCatch,
  errorToString,
  unwrap,
} from "types";
import type { ExtensionContext, WebviewPanel } from "vscode";
import { Uri, ViewColumn, window } from "vscode";
import type { ConfigManager } from "./configManager";
import type { Logger } from "./logger";
import type { SelectResponse } from "./runner";

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
  readonly startProcessing: () => Promise<Result<UnknownError, void>>;

  readonly renderMetadata: (
    metadata: Metadata
  ) => Promise<Result<UnknownError, void>>;
  readonly renderRoutine: (
    routine: Routine
  ) => Promise<Result<UnknownError, void>>;
  readonly renderTable: (data: {
    heads: ReadonlyArray<Accessor>;
    table: Table;
  }) => Promise<Result<UnknownError, void>>;
  readonly renderRows: (
    data: SelectResponse
  ) => Promise<Result<UnknownError | Err<"NoSchema">, void>>;

  readonly successProcessing: () => Promise<Result<UnknownError, void>>;
  readonly failProcessing: (
    error: Err<string>
  ) => Promise<Result<UnknownError, void>>;

  moveTabFocus(diff: number): Promise<Result<UnknownError, void>>;
  focusOnTab(tab: Tab): Promise<Result<UnknownError, void>>;

  readonly dispose: () => void;
};

export function createRendererManager({
  ctx,
  logger: parentLogger,
  configManager,
  onPrevPageRequested,
  onNextPageRequested,
  onDownloadRequested,
  onPreviewRequested,
  onDidDisposePanel,
}: Readonly<{
  ctx: ExtensionContext;
  logger: Logger;
  configManager: ConfigManager;
  onPrevPageRequested: (params: {
    event: PrevEvent;
    renderer: Renderer;
  }) => unknown;
  onNextPageRequested: (params: {
    event: NextEvent;
    renderer: Renderer;
  }) => unknown;
  onDownloadRequested: (params: {
    event: DownloadEvent;
    renderer: Renderer;
  }) => unknown;
  onPreviewRequested: (params: {
    event: PreviewEvent;
    renderer: Renderer;
  }) => unknown;
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

          const postMessage = ({
            logger,
            event,
          }: {
            logger: Logger;
            event: RendererEvent;
          }): Promise<Result<UnknownError, void>> => {
            return tryCatch(
              async () => {
                await panel.webview.postMessage({
                  source: "bigquery-runner",
                  payload: event,
                });
              },
              (err) => {
                logger.error(err);
                return {
                  type: "Unknown" as const,
                  reason: errorToString(err),
                };
              }
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
                onPrevPageRequested({ event, renderer });
              } else if (isNextEvent(event)) {
                onNextPageRequested({ event, renderer });
              } else if (isDownloadEvent(event)) {
                onDownloadRequested({ event, renderer });
              } else if (isPreviewEvent(event)) {
                onPreviewRequested({ event, renderer });
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

            startProcessing() {
              return postMessage({
                logger: parentLogger.createChild("startProcessing"),
                event: {
                  event: "startProcessing",
                },
              });
            },

            renderMetadata(metadata) {
              return postMessage({
                logger: parentLogger.createChild("renderMetadata"),
                event: {
                  event: "metadata",
                  payload: {
                    metadata,
                  },
                },
              });
            },

            renderRoutine(routine) {
              return postMessage({
                logger: parentLogger.createChild("renderRoutine"),
                event: {
                  event: "routine",
                  payload: {
                    routine,
                  },
                },
              });
            },

            renderTable({ heads, table }) {
              return postMessage({
                logger: parentLogger.createChild("renderTable"),
                event: {
                  event: "table",
                  payload: {
                    heads,
                    table,
                  },
                },
              });
            },

            async renderRows({ structs, table, page }) {
              const logger = parentLogger.createChild("renderRows");

              const flatResult = createFlat(table.schema.fields);
              if (!flatResult.success) {
                return flatResult;
              }
              const flat = unwrap(flatResult);

              logger.log(`${structs.length} rows`);

              return postMessage({
                logger,
                event: {
                  event: "rows",
                  payload: {
                    heads: flat.heads,
                    rows: flat.getNumberedRows({
                      structs,
                      rowNumberStart: page.startRowNumber,
                    }),
                    page: toSerializablePage(page),
                  },
                },
              });
            },

            successProcessing() {
              return postMessage({
                logger: parentLogger.createChild("successProcessing"),
                event: {
                  event: "successProcessing",
                },
              });
            },

            failProcessing(error) {
              return postMessage({
                logger: parentLogger.createChild("failProcessing"),
                event: {
                  event: "failProcessing",
                  payload: error,
                },
              });
            },

            moveTabFocus(diff) {
              return postMessage({
                logger: parentLogger.createChild("moveTabFocus"),
                event: {
                  event: "moveTabFocus",
                  payload: {
                    diff,
                  },
                },
              });
            },

            focusOnTab(tab) {
              return postMessage({
                logger: parentLogger.createChild("focusOnTab"),
                event: {
                  event: "focusOnTab",
                  payload: {
                    tab,
                  },
                },
              });
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
          type: "Unknown" as const,
          reason: errorToString(err),
        })
      );
    },

    dispose() {
      renderers.clear();
    },
  };
}
