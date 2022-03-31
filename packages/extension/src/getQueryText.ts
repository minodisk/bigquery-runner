import { Range, TextDocument } from "vscode";

export async function getQueryText({
  document,
  range,
}: {
  readonly document: TextDocument;
  readonly range?: Range;
}): Promise<string> {
  const text = (() => {
    if (range?.isEmpty) {
      return document.getText();
    }
    return document.getText(range);
  })();

  if (text.trim() === "") {
    throw new Error("text is empty");
  }

  return text;
}
