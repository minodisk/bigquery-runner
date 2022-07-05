import { readFile } from "fs/promises";
import { join } from "path";
import { createFlat, toSerializablePage } from "core";
import {
  isDownloadEvent,
  isLoadedEvent,
  isNextEvent,
  isPrevEvent,
  isPreviewEvent,
  Metadata,
  Result,
  Routine,
  Table,
  tryCatch,
  ViewerEvent,
  UnknownError,
  RunnerID,
  RendererEvent,
  errorToString,
  unwrap,
  Error,
  fail,
  PrevEvent,
  NextEvent,
  DownloadEvent,
  PreviewEvent,
} from "types";
import {
  ExtensionContext,
  Uri,
  ViewColumn,
  WebviewPanel,
  window,
} from "vscode";
import { ConfigManager } from "./configManager";
import { Logger } from "./logger";
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
  ) => Promise<Result<UnknownError | Error<"NoSchema">, void>>;

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

            startLoading() {
              return postMessage({
                logger: parentLogger.createChild("startLoading"),
                event: {
                  event: "open",
                },
              });
            },

            cancelLoading() {
              return postMessage({
                logger: parentLogger.createChild("cancelLoading"),
                event: {
                  event: "close",
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

            renderTable(table) {
              return postMessage({
                logger: parentLogger.createChild("renderTable"),
                event: {
                  event: "table",
                  payload: {
                    table,
                  },
                },
              });
            },

            async renderRows({ structs, table, page }) {
              const logger = parentLogger.createChild("renderRows");

              if (table.schema.fields === undefined) {
                return fail({
                  type: "NoSchema" as const,
                  reason: "fields is not defined",
                });
              }

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
                    header: flat.heads.map(({ id }) => id),
                    rows: flat.toRows({
                      structs,
                      rowNumberStart: page.rowNumberStart,
                    }),
                    page: toSerializablePage(page),
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
