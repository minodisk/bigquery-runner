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
  Tab,
} from "shared";
import {
  getTableName,
  getRoutineName,
  isDownloadEvent,
  isLoadedEvent,
  isNextEvent,
  isPrevEvent,
  isPreviewEvent,
  tryCatch,
  errorToString,
} from "shared";
import type { ExtensionContext, WebviewPanel } from "vscode";
import { Uri, ViewColumn, window } from "vscode";
import type { ConfigManager } from "./configManager";
import type { Logger } from "./logger";
import type { SelectResponse } from "./runner";

export type RendererManager = Readonly<{
  get(props: { runnerId: RunnerID }): Renderer | undefined;
  create(
    props: Readonly<{
      runnerId: RunnerID;
      title: string;
      baseViewColumn?: ViewColumn;
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
  readonly renderTables: (
    tables: ReadonlyArray<Table>
  ) => Promise<Result<UnknownError, void>>;
  readonly renderRoutines: (
    routines: ReadonlyArray<Routine>
  ) => Promise<Result<UnknownError, void>>;
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
  logger,
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
    get({ runnerId }) {
      const l = logger.createChild("get");
      l.log(runnerId);
      const r = renderers.get(runnerId);
      if (r) {
        l.log("found a renderer made in the past");
        return r;
      }

      l.log("not found");
      return;
    },

    create({ runnerId, title, baseViewColumn }) {
      const l = logger.createChild("create");
      l.log(runnerId, title, baseViewColumn?.toString() ?? "");
      return tryCatch(
        async () => {
          const r = renderers.get(runnerId);
          if (r) {
            l.log("found a renderer made in the past");
            return r;
          }

          l.log("create a new renderer");

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
          const rootFile = Uri.file(root);
          const html = await readFile(join(root, "index.html"), "utf-8");

          const postMessage = ({
            logger,
            event,
          }: {
            logger: Logger;
            event: RendererEvent;
          }): Promise<Result<UnknownError, void>> => {
            logger.log("postMessage");
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
                localResourceRoots: [rootFile],
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
              logger.log("onDidDispose");
              if (renderer) {
                renderer.dispose();
              }
            });
            panel.iconPath = Uri.file(
              join(ctx.extensionPath, "out/assets/icon-panel.png")
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

            panel.webview.html = html.replace(
              "<head>",
              `<head><base href="${panel.webview
                .asWebviewUri(rootFile)
                .toString()}/" />`
            );
          });

          const renderer: Renderer = {
            disposed: false,

            runnerId,

            viewColumn,

            reveal() {
              logger.log("reveal");
              panel.reveal(undefined, true);
            },

            startProcessing() {
              return postMessage({
                logger: logger.createChild("startProcessing"),
                event: {
                  event: "startProcessing",
                },
              });
            },

            renderMetadata(metadata) {
              return postMessage({
                logger: logger.createChild("renderMetadata"),
                event: {
                  event: "metadata",
                  payload: {
                    metadata,
                  },
                },
              });
            },

            async renderTables(tables) {
              return postMessage({
                logger: logger.createChild("renderTables"),
                event: {
                  event: "tables",
                  payload: tables.map((table) => ({
                    id: getTableName(table.tableReference),
                    heads: createFlat(table.schema.fields).heads,
                    table,
                  })),
                },
              });
            },

            async renderRoutines(routines) {
              return postMessage({
                logger: logger.createChild("renderRoutines"),
                event: {
                  event: "routines",
                  payload: routines.map((routine) => ({
                    id: getRoutineName(routine.metadata.routineReference),
                    routine,
                  })),
                },
              });
            },

            async renderRows({ structs, table, page }) {
              const l = logger.createChild("renderRows");
              const flat = createFlat(table.schema.fields);
              l.log(`${structs.length} rows`);
              return postMessage({
                logger: l,
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
                logger: logger.createChild("successProcessing"),
                event: {
                  event: "successProcessing",
                },
              });
            },

            failProcessing(error) {
              return postMessage({
                logger: logger.createChild("failProcessing"),
                event: {
                  event: "failProcessing",
                  payload: error,
                },
              });
            },

            moveTabFocus(diff) {
              return postMessage({
                logger: logger.createChild("moveTabFocus"),
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
                logger: logger.createChild("focusOnTab"),
                event: {
                  event: "focusOnTab",
                  payload: {
                    tab,
                  },
                },
              });
            },

            dispose() {
              logger.log("dispose");
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
