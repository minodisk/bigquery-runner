import { Diagnostic, languages, Position, Range, TextDocument } from "vscode";

export type ErrorMarker = ReturnType<typeof createErrorMarker>;

export function createErrorMarker({ section }: { section: string }) {
  const diagnosticCollection = languages.createDiagnosticCollection(section);

  return {
    clear({ document }: { readonly document: TextDocument }) {
      diagnosticCollection.delete(document.uri);
    },

    mark({
      document,
      err,
      selection,
    }: {
      readonly document: TextDocument;
      readonly err: unknown;
      readonly selection?: Range;
    }) {
      if (!(err instanceof Error)) {
        diagnosticCollection.set(document.uri, [
          new Diagnostic(
            selection
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
            selection
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
      const line = (selection ? selection.start.line : 0) + Number(l) - 1;
      const character =
        (selection ? selection.start.character : 0) + Number(c) - 1;
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
