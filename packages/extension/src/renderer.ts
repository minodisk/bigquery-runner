import { readFile } from "fs/promises";
import { basename, join } from "path";
import { format } from "bytes";
import { createFlat, toSerializablePage } from "core";
import {
  isDownloadEvent,
  isLoadedEvent,
  isNextEvent,
  isPrevEvent,
  isPreviewEvent,
  Metadata,
  RendererEvent,
  Routine,
  RunnerID,
  Table,
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
import { SelectResponse } from "./runner";
import { StatusManager } from "./statusManager";

export type RendererManager = Readonly<
  ReturnType<typeof createRendererManager>
>;

export type Renderer = {
  readonly runnerId: RunnerID;
  disposed: boolean;
  readonly viewColumn: ViewColumn;
  readonly reveal: () => void;
  readonly open: () => Promise<void>;

  readonly renderMetadata: (data: { metadata: Metadata }) => Promise<void>;
  readonly renderRoutine: (data: { routine: Routine }) => Promise<void>;
  readonly renderTable: (data: { table: Table }) => Promise<void>;
  readonly renderRows: (data: SelectResponse) => Promise<void>;

  readonly error: () => void;
  readonly close: () => Promise<void>;
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
}>) {
  const renderers = new Map<RunnerID, Renderer>();

  return {
    async create({
      runnerId,
      viewColumn: baseViewColumn,
    }: Readonly<{
      runnerId: RunnerID;
      viewColumn?: ViewColumn;
    }>) {
      const config = configManager.get();
      const column = config.viewer.column;
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
      const html = (await readFile(join(root, "index.html"), "utf-8")).replace(
        "<head>",
        `<head><base href="${base}/" />`
      );

      const panel = await new Promise<WebviewPanel>((resolve) => {
        let resolved = false;

        const panel = window.createWebviewPanel(
          `bigqueryRunner:${runnerId}`,
          basename(runnerId),
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

        panel.onDidChangeViewState((e) =>
          postMessage({
            event: "focused",
            payload: {
              focused: e.webviewPanel.active,
            },
          })
        );
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

      async function postMessage(event: RendererEvent) {
        await panel.webview.postMessage({
          source: "bigquery-runner",
          payload: event,
        });
      }

      const renderer: Renderer = {
        runnerId,

        disposed: false,

        viewColumn,

        reveal() {
          panel.reveal(undefined, true);
        },

        async open() {
          statusManager.loadBilled({ fileName: runnerId });
          await postMessage({
            event: "open",
          });
        },

        async renderMetadata({ metadata }) {
          await postMessage({
            event: "metadata",
            payload: {
              metadata,
            },
          });
        },

        async renderRoutine({ routine }) {
          await postMessage({
            event: "routine",
            payload: {
              routine,
            },
          });
        },

        async renderTable({ table }) {
          await postMessage({
            event: "table",
            payload: {
              table,
            },
          });
        },

        async renderRows({ metadata, structs, table, page }) {
          try {
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
              billed: { bytes, cacheHit: metadata.statistics.query.cacheHit },
            });
          } catch (err) {
            statusManager.errorBilled({ fileName: runnerId });
            throw err;
          }
        },

        error() {
          statusManager.errorBilled({ fileName: runnerId });
        },

        async close() {
          await postMessage({
            event: "close",
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

    get(runnerId: RunnerID) {
      return renderers.get(runnerId);
    },

    delete(runnerId: RunnerID) {
      return renderers.delete(runnerId);
    },

    dispose() {
      renderers.clear();
    },
  };
}
