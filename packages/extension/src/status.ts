import {
  MarkdownString,
  StatusBarAlignment,
  TextDocument,
  window,
} from "vscode";
import { Config } from "./config";

export function createStatusManager({
  options,
  createStatusBarItem,
}: {
  options: Config["statusBarItem"];
  createStatusBarItem: ReturnType<typeof createStatusBarItemCreator>;
}) {
  let statusBarItem = createStatusBarItem(options);
  let messages = new Map<
    string,
    { text: string; tooltip: string | MarkdownString }
  >();

  return {
    set(
      document: TextDocument,
      text: string,
      tooltip: string | MarkdownString
    ) {
      messages.set(document.fileName, { text, tooltip });
      if (document.fileName === window.activeTextEditor?.document.fileName) {
        statusBarItem.text = text;
        statusBarItem.tooltip = tooltip;
        statusBarItem.show();
      }
    },
    hide() {
      statusBarItem.hide();
      statusBarItem.text = "";
      statusBarItem.tooltip = undefined;
    },
    updateOptions(options: Config["statusBarItem"]) {
      statusBarItem.dispose();
      statusBarItem = createStatusBarItem(options);
    },
    dispose() {
      statusBarItem.dispose();
      messages.forEach((_, key) => messages.delete(key));
      messages = undefined!;
    },
  };
}
export type StatusManager = ReturnType<typeof createStatusManager>;

export function createStatusBarItemCreator(w: typeof window) {
  return (options: Config["statusBarItem"]) => {
    return w.createStatusBarItem(
      options.align === "left"
        ? StatusBarAlignment.Left
        : options.align === "right"
        ? StatusBarAlignment.Right
        : undefined,
      options.priority
    );
  };
}
