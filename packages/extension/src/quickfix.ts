import type { Disposable, TextDocument } from "vscode";
import {
  CodeAction,
  CodeActionKind,
  languages,
  Position,
  Range,
  WorkspaceEdit,
} from "vscode";
import type { Config, ConfigManager } from "./configManager";

export type QuickFixManager = ReturnType<typeof createQuickFixManager>;

export type QuickFix = {
  register(params: {
    start: { line: number; character: number };
    before: string;
    after: string;
  }): void;
  clear(): void;
};

export const createQuickFixManager = ({
  configManager,
}: {
  configManager: ConfigManager;
}): Disposable & {
  get(document: TextDocument): QuickFix;
} => {
  const codeActionsWithRange = new Map<
    TextDocument,
    Array<{ action: CodeAction; range: Range }>
  >();

  let unregister: Disposable = {
    dispose() {
      // do nothing
    },
  };
  let languageIds: Array<string> = [];
  let extensions: Array<string> = [];
  const register = (config: Config) => {
    // ignore when languageIds is not changed
    if (
      JSON.stringify(languageIds) === JSON.stringify(config.languageIds) &&
      JSON.stringify(extensions) === JSON.stringify(config.extensions)
    ) {
      return;
    }
    languageIds = config.languageIds;
    extensions = config.extensions;

    unregister.dispose();
    unregister = languages.registerCodeActionsProvider(
      [
        ...config.languageIds.map((language) => ({ language })),
        ...config.extensions.map((ext) => ({ pattern: `**/*${ext}` })),
      ],
      {
        provideCodeActions(document, range) {
          const actionsWithRange = codeActionsWithRange.get(document);
          if (!actionsWithRange) {
            return;
          }
          const actions = actionsWithRange
            .filter((actionWithRange) =>
              actionWithRange.range.intersection(range)
            )
            .map(({ action }) => action);
          if (!actions.length) {
            return;
          }
          return actions;
        },
      },
      {
        providedCodeActionKinds: [CodeActionKind.QuickFix],
      }
    );
  };
  register(configManager.get());
  const subscriptions = [configManager.onChange(register)];

  return {
    get(document) {
      return {
        register({ start, before, after }) {
          const action = new CodeAction(
            `Change name to '${after}'`,
            CodeActionKind.QuickFix
          );
          const edit = new WorkspaceEdit();
          const range = new Range(
            new Position(start.line, start.character),
            new Position(start.line, start.character + before.length)
          );
          edit.replace(document.uri, range, after);
          action.edit = edit;
          codeActionsWithRange.set(document, [
            {
              range,
              action,
            },
          ]);
        },

        clear() {
          codeActionsWithRange.delete(document);
        },
      };
    },

    dispose() {
      subscriptions.forEach((s) => s.dispose());
      unregister.dispose();
      codeActionsWithRange.clear();
    },
  };
};
