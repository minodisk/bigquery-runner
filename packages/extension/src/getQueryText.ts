import type { TextEditor } from "vscode";

export async function getQueryText(editor: TextEditor): Promise<string> {
  const text = (() => {
    const selections = editor.selections.filter(
      (selection) => !selection.isEmpty
    );
    if (selections.length === 0) {
      return editor.document.getText();
    }
    return selections
      .map((selection) => editor.document.getText(selection))
      .join("\n");
  })();

  if (text.trim() === "") {
    throw new Error("text is empty");
  }

  return text;
}
