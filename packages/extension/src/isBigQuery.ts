import { extname } from "path";
import { TextDocument } from "vscode";
import { Config } from "./config";

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
