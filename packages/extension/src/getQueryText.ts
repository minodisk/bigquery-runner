import { TextEditor } from "vscode";

export async function getQueryText(editor: TextEditor): Promise<string> {
  const { document, selections } = editor;

  const text = (() => {
    const sels = selections.filter((selection) => !selection.isEmpty);
    if (sels.length === 0) {
      return document.getText();
    }
    return sels.map((selection) => document.getText(selection)).join("\n");
  })();

  if (text.trim() === "") {
    throw new Error("text is empty");
  }

  return text;
}
