import type { RunnerID } from "shared";
import type { TextEditor } from "vscode";
import { Diagnostic, languages, Position, Range, workspace } from "vscode";

export type ErrorMarkerManager = ReturnType<typeof createErrorMarkerManager>;
export type ErrorMarker = Readonly<{
  markAt(
    props: Readonly<{
      reason: string;
      position: { line: number; character: number };
    }>
  ): void;
  markAll(
    props: Readonly<{
      reason: string;
    }>
  ): void;
  clear(): void;
}>;

export function createErrorMarkerManager(section: string) {
  const diagnosticCollection = languages.createDiagnosticCollection(section);
  const errorMarkers = new Map<RunnerID, ErrorMarker>();

  return {
    get({
      runnerId,
      editor,
    }: {
      runnerId: RunnerID;
      editor: TextEditor;
    }): ErrorMarker {
      const m = errorMarkers.get(runnerId);
      if (m) {
        return m;
      }

      const marker: ErrorMarker = {
        markAt({ reason, position: { line, character } }) {
          const {
            document: { fileName },
            selections,
          } = editor;

          const document = workspace.textDocuments.find(
            (document) => document.fileName === fileName
          );
          if (!document) {
            return;
          }

          if (selections.some((s) => !s.isEmpty)) {
            diagnosticCollection.set(
              document.uri,
              selections.map(
                (selection) =>
                  new Diagnostic(
                    new Range(selection.start, selection.end),
                    reason
                  )
              )
            );
            return;
          }

          const wordRange = document.getWordRangeAtPosition(
            new Position(line, character)
          );
          diagnosticCollection.set(document.uri, [
            new Diagnostic(
              wordRange ??
                new Range(
                  new Position(line, character),
                  new Position(line, character + 1)
                ),
              reason
            ),
          ]);
        },

        markAll({ reason }) {
          const {
            document: { fileName },
            selections,
          } = editor;

          const document = workspace.textDocuments.find(
            (document) => document.fileName === fileName
          );
          if (!document) {
            return;
          }

          if (selections.some((s) => !s.isEmpty)) {
            diagnosticCollection.set(
              document.uri,
              selections.map(
                (selection) =>
                  new Diagnostic(
                    new Range(selection.start, selection.end),
                    reason
                  )
              )
            );
            return;
          }

          diagnosticCollection.set(document.uri, [
            new Diagnostic(
              new Range(
                document.lineAt(0).range.start,
                document.lineAt(document.lineCount - 1).range.end
              ),
              reason
            ),
          ]);
          return;
        },

        clear() {
          diagnosticCollection.delete(editor.document.uri);
        },
      };
      errorMarkers.set(runnerId, marker);

      return marker;
    },

    dispose() {
      errorMarkers.clear();
      diagnosticCollection.dispose();
    },
  };
}
