import { ViewerEvent } from "core/src/types";
import { readFile } from "fs/promises";
import { basename, join } from "path";
import {
  ExtensionContext,
  Uri,
  ViewColumn,
  WebviewPanel,
  window,
} from "vscode";
import { ConfigManager } from "./configManager";

export type PanelManager = ReturnType<typeof createPanelManager>;

export function createPanelManager({
  ctx,
  configManager,
  onDidReceiveMessage,
  onDidDisposePanel,
}: {
  readonly ctx: ExtensionContext;
  readonly configManager: ConfigManager;
  readonly onDidReceiveMessage: (e: ViewerEvent) => unknown;
  readonly onDidDisposePanel: (e: { readonly fileName: string }) => unknown;
}) {
  const map: Map<string, WebviewPanel> = new Map();

  return {
    async create({
      fileName,
      viewColumn,
    }: {
      readonly fileName: string;
      readonly viewColumn?: ViewColumn;
    }): Promise<WebviewPanel> {
      const p = map.get(fileName);
      if (p) {
        p.reveal(undefined, true);
        return p;
      }

      const config = configManager.get();
      const column = config.output.viewer.column;
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
      map.set(fileName, panel);
      panel.iconPath = Uri.file(
        join(ctx.extensionPath, "out/assets/icon-small.png")
      );
      panel.webview.html = html;
      panel.webview.onDidReceiveMessage((e: ViewerEvent) => {
        onDidReceiveMessage(e);
      });
      panel.onDidDispose(() => {
        onDidDisposePanel({ fileName });
      });
      ctx.subscriptions.push(panel);
      return panel;
    },

    exists({ fileName }: { readonly fileName: string }) {
      return map.has(fileName);
    },

    getActive() {
      const e = Array.from(map.entries()).find(([, panel]) => panel.active);
      if (!e) {
        return;
      }
      const [fileName, panel] = e;
      return {
        fileName,
        panel,
      };
    },

    delete({ fileName }: { readonly fileName: string }) {
      return map.delete(fileName);
    },

    dispose() {
      map.clear();
    },
  };
}
