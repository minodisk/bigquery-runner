import { TextDocument } from "vscode";

export type TextDoc = TextDocument | FileName;

export type FileName = {
  readonly fileName: string;
};

export function isTextDocument(d: any): d is TextDocument {
  return d.uri !== null;
}
