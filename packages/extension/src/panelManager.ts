import { readFile } from "fs/promises";
import { basename, join } from "path";
import { ExtensionContext, Uri, WebviewPanel, window } from "vscode";

export type PanelManager = ReturnType<typeof createPanelManager>;

export function createPanelManager({
  ctx,
  onDidDisposePanel,
}: {
  readonly ctx: ExtensionContext;
  readonly onDidDisposePanel: (e: { readonly fileName: string }) => unknown;
}) {
  const map: Map<string, WebviewPanel> = new Map();

  return {
    async get({
      fileName,
    }: {
      readonly fileName: string;
    }): Promise<WebviewPanel> {
      const p = map.get(fileName);
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
        `bigqueryRunner:${fileName}`,
        basename(fileName),
        { viewColumn: -2, preserveFocus: true },
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
      panel.onDidDispose(() => {
        onDidDisposePanel({ fileName });
      });
      ctx.subscriptions.push(panel);
      return panel;
    },

    exists({ fileName }: { readonly fileName: string }) {
      console.log("exists:", fileName, map);
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
