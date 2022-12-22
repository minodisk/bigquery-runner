import type { Result, Err } from "shared";
import { succeed, fail } from "shared";
import type { TextEditor } from "vscode";

export async function getQueryText(
  editor: TextEditor
): Promise<Result<Err<"NoText">, string>> {
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
    return fail({
      type: "NoText" as const,
      reason: `no text in the editor`,
    });
  }

  return succeed(text);
}
