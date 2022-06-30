import {
  Diagnostic,
  languages,
  Position,
  Range,
  Selection,
  workspace,
} from "vscode";

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

    markAt({
      fileName,
      reason,
      position: { line, character },
      selections,
    }: Readonly<{
      fileName: string;
      reason: string;
      position: { line: number; character: number };
      selections: readonly Selection[];
    }>) {
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
              new Diagnostic(new Range(selection.start, selection.end), reason)
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

    markAll({
      fileName,
      reason,
      selections,
    }: Readonly<{
      fileName: string;
      reason: string;
      selections: readonly Selection[];
    }>) {
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
              new Diagnostic(new Range(selection.start, selection.end), reason)
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

    // mark({
    //   fileName,
    //   err,
    //   selections,
    // }: {
    //   readonly fileName: string;
    //   readonly err: unknown;
    //   readonly selections: readonly Selection[];
    // }) {
    //   const document = workspace.textDocuments.find(
    //     (document) => document.fileName === fileName
    //   );
    //   if (!document) {
    //     return;
    //   }

    //   if (!(err instanceof Error)) {
    //     if (selections.some((s) => !s.isEmpty)) {
    //       diagnosticCollection.set(
    //         document.uri,
    //         selections.map(
    //           (selection) =>
    //             new Diagnostic(
    //               new Range(selection.start, selection.end),
    //               `${err}`
    //             )
    //         )
    //       );
    //       return;
    //     }
    //     diagnosticCollection.set(document.uri, [
    //       new Diagnostic(
    //         new Range(
    //           document.lineAt(0).range.start,
    //           document.lineAt(document.lineCount - 1).range.end
    //         ),
    //         `${err}`
    //       ),
    //     ]);
    //     return;
    //   }

    //   const { message } = err;
    //   const rMessage = /^(.*?) at \[(\d+):(\d+)\]$/;
    //   const res = rMessage.exec(message);
    //   if (!res) {
    //     if (selections.some((s) => !s.isEmpty)) {
    //       diagnosticCollection.set(
    //         document.uri,
    //         selections.map(
    //           (selection) =>
    //             new Diagnostic(
    //               new Range(selection.start, selection.end),
    //               `${err}`
    //             )
    //         )
    //       );
    //       return;
    //     }
    //     diagnosticCollection.set(document.uri, [
    //       new Diagnostic(
    //         new Range(
    //           document.lineAt(0).range.start,
    //           document.lineAt(document.lineCount - 1).range.end
    //         ),
    //         `${err}`
    //       ),
    //     ]);
    //     return;
    //   }

    //   if (selections.some((s) => !s.isEmpty)) {
    //     diagnosticCollection.set(
    //       document.uri,
    //       selections.map(
    //         (selection) =>
    //           new Diagnostic(
    //             new Range(selection.start, selection.end),
    //             `${err}`
    //           )
    //       )
    //     );
    //     return;
    //   }

    //   const [_, errorMessage, l, c] = res;
    //   const line = Number(l) - 1;
    //   const character = Number(c) - 1;
    //   const wordRange = document.getWordRangeAtPosition(
    //     new Position(line, character)
    //   );
    //   diagnosticCollection.set(document.uri, [
    //     new Diagnostic(
    //       wordRange ??
    //         new Range(
    //           new Position(line, character),
    //           new Position(line, character + 1)
    //         ),
    //       errorMessage ?? ""
    //     ),
    //   ]);
    // },

    dispose() {
      diagnosticCollection.dispose();
    },
  };
}
