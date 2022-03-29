import { readFile } from "fs/promises";
import { basename, join } from "path";
import {
  ExtensionContext,
  TextDocument,
  Uri,
  WebviewPanel,
  window,
} from "vscode";

export type PanelManager = ReturnType<typeof createPanelManager>;

export function createPanelManager({
  ctx,
  onDidDisposePanel,
}: {
  readonly ctx: ExtensionContext;
  readonly onDidDisposePanel: (e: {
    readonly document: TextDocument;
  }) => unknown;
}) {
  const map: Map<string, WebviewPanel> = new Map();

  return {
    async get({
      document,
    }: {
      readonly document: TextDocument;
    }): Promise<WebviewPanel> {
      const p = map.get(document.fileName);
      if (p) {
        p.reveal(undefined, true);
        return p;
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
        `bigqueryRunner:${document.fileName}`,
        basename(document.fileName),
        { viewColumn: -2, preserveFocus: true },
        {
          enableScripts: true,
          localResourceRoots: [Uri.file(root)],
        }
      );
      map.set(document.fileName, panel);
      panel.iconPath = Uri.file(
        join(ctx.extensionPath, "out/assets/icon-small.png")
      );
      panel.webview.html = html;
      panel.onDidDispose(() => {
        onDidDisposePanel({ document });
      });
      ctx.subscriptions.push(panel);
      return panel;
    },

    exists({ document }: { readonly document: TextDocument }) {
      console.log("exists:", document, map);
      return map.has(document.fileName);
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

    delete({ document }: { readonly document: TextDocument }) {
      return map.delete(document.fileName);
    },

    dispose() {
      map.clear();
    },
  };
}
