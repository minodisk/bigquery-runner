import { extname } from "path";
import type { TextDocument } from "vscode";
import type { Config } from "./configManager";

export function isBigQuery({
  config,
  document,
}: {
  readonly config: Config;
  readonly document: TextDocument;
}): boolean {
  return (
    config.languageIds.includes(document.languageId) ||
    config.extensions.includes(extname(document.fileName))
  );
}
