import { Diagnostic, languages, Position, Range, workspace } from "vscode";

export type ErrorMarker = ReturnType<typeof createErrorMarker>;

export function createErrorMarker({ section }: { section: string }) {
  const diagnosticCollection = languages.createDiagnosticCollection(section);

  return {
    clear({ fileName }: { readonly fileName: string }) {
      const document = workspace.textDocuments.find(
        (document) => document.fileName === fileName
      );
      if (!document) {
        return;
      }
      diagnosticCollection.delete(document.uri);
    },

    mark({
      fileName,
      err,
      selection,
    }: {
      readonly fileName: string;
      readonly err: unknown;
      readonly selection?: Range;
    }) {
      const document = workspace.textDocuments.find(
        (document) => document.fileName === fileName
      );
      if (!document) {
        return;
      }

      if (!(err instanceof Error)) {
        diagnosticCollection.set(document.uri, [
          new Diagnostic(
            selection && !selection.isEmpty
              ? new Range(selection.start, selection.end)
              : new Range(
                  document.lineAt(0).range.start,
                  document.lineAt(document.lineCount - 1).range.end
                ),
            `${err}`
          ),
        ]);
        return;
      }

      const { message } = err;
      const rMessage = /^(.*?) at \[(\d+):(\d+)\]$/;
      const res = rMessage.exec(message);
      if (!res) {
        diagnosticCollection.set(document.uri, [
          new Diagnostic(
            selection && !selection.isEmpty
              ? new Range(selection.start, selection.end)
              : new Range(
                  document.lineAt(0).range.start,
                  document.lineAt(document.lineCount - 1).range.end
                ),
            `${err}`
          ),
        ]);
        return;
      }

      const [_, m, l, c] = res;
      const line =
        (selection && !selection.isEmpty ? selection.start.line : 0) +
        Number(l) -
        1;
      const character =
        (selection && !selection.isEmpty ? selection.start.character : 0) +
        Number(c) -
        1;
      const range = document.getWordRangeAtPosition(
        new Position(line, character)
      );
      diagnosticCollection.set(document.uri, [
        new Diagnostic(
          range ??
            new Range(
              new Position(line, character),
              new Position(line, character + 1)
            ),
          m ?? ""
        ),
      ]);
    },

    dispose() {
      diagnosticCollection.dispose();
    },
  };
}
