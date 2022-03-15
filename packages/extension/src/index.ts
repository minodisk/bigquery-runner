// Copyright 2018 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  commands,
  DiagnosticCollection,
  ExtensionContext,
  OutputChannel as OrigOutputChannel,
  Range,
  TextDocument,
  window,
  workspace,
} from "vscode";
import { AuthenticationError, NoPageTokenError } from "core";
import {
  createStatusBarItemCreator,
  createStatusManager,
} from "./statusManager";
import { createConfigManager } from "./configManager";
import { createDryRunner, createRunner, ErrorWithId } from "./runner";
import { createErrorMarker } from "./errorMarker";
import { isBigQuery } from "./isBigQuery";
import { createValidator } from "./validator";

export type OutputChannel = Pick<
  OrigOutputChannel,
  "append" | "appendLine" | "show" | "dispose"
>;

type ResultChannel = {
  set(result: Result): void;
  get(): Result;
};

export type Result = {
  readonly jobId?: string;
};

export type Dependencies = {
  readonly outputChannel: OutputChannel;
  readonly resultChannel: ResultChannel;
  readonly diagnosticCollection: DiagnosticCollection;
};

export async function activate(
  ctx: ExtensionContext,
  dependencies?: Dependencies
) {
  try {
    const title = "BigQuery Runner";
    const section = "bigqueryRunner";

    const outputChannel =
      dependencies?.outputChannel ?? window.createOutputChannel(title);
    ctx.subscriptions.push(outputChannel);

    const resultChannel = dependencies?.resultChannel ?? {
      get(): Result {
        return {};
      },
      set() {
        // do nothing
      },
    };

    const configManager = createConfigManager(section);
    const statusManager = createStatusManager({
      options: configManager.get().statusBarItem,
      createStatusBarItem: createStatusBarItemCreator(window),
    });
    const errorMarker = createErrorMarker({
      section,
    });
    const runner = createRunner({
      ctx,
      outputChannel,
      configManager,
      statusManager,
      errorMarker,
    });
    const dryRunner = createDryRunner({
      outputChannel,
      configManager,
      statusManager,
      errorMarker,
    });
    const validator = createValidator({
      outputChannel,
      configManager,
      dryRunner,
    });
    ctx.subscriptions.push(
      configManager,
      statusManager,
      errorMarker,
      runner,
      dryRunner,
      validator
    );

    // Register all available commands and their actions.
    // CommandMap describes a map of extension commands (defined in package.json)
    // and the function they invoke.
    new Map<string, () => void>([
      [
        `${section}.dryRun`,
        wrapCallback({
          outputChannel,
          resultChannel,
          callback: dryRunner.run,
        }),
      ],
      [
        `${section}.run`,
        wrapCallback({
          outputChannel,
          resultChannel,
          callback: runner.run,
        }),
      ],
      [
        `${section}.prevPage`,
        wrapCallback({
          outputChannel,
          resultChannel,
          callback: runner.gotoPrevPage,
        }),
      ],
      [
        `${section}.nextPage`,
        wrapCallback({
          outputChannel,
          resultChannel,
          callback: runner.gotoNextPage,
        }),
      ],
    ]).forEach((action, name) => {
      ctx.subscriptions.push(commands.registerCommand(name, action));
    });

    workspace.textDocuments.forEach((document) =>
      validator.validate({
        document,
      })
    );
    ctx.subscriptions.push(
      window.onDidChangeActiveTextEditor((editor) => {
        if (
          !editor ||
          !isBigQuery({
            config: configManager.get(),
            document: editor.document,
          })
        ) {
          statusManager.hide();
          return;
        }

        statusManager.onFocus({ document: editor.document });
        validator.validate({
          document: editor.document,
        });
      }),
      workspace.onDidOpenTextDocument((document) =>
        validator.validate({
          document,
        })
      ),
      workspace.onDidChangeTextDocument(({ document }) =>
        validator.validate({
          document,
        })
      ),
      workspace.onDidSaveTextDocument((document) =>
        validator.validate({
          document,
        })
      ),
      // Listen for configuration changes and trigger an update, so that users don't
      // have to reload the VS Code environment after a config update.
      workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration(section)) {
          return;
        }
        configManager.refresh();
        statusManager.updateOptions(configManager.get().statusBarItem);
      })
    );
  } catch (err) {
    window.showErrorMessage(`${err}`);
  }
}

export function deactivate() {
  // do nothing
}

function wrapCallback({
  outputChannel,
  resultChannel,
  callback,
}: {
  readonly outputChannel: OutputChannel;
  readonly resultChannel: ResultChannel;
  readonly callback: (params: {
    readonly document: TextDocument;
    readonly selection?: Range;
  }) => Promise<Result>;
}): () => Promise<void> {
  return async () => {
    try {
      if (!window.activeTextEditor) {
        throw new Error("no active text editor");
      }
      const { document, selection } = window.activeTextEditor;
      const result = await callback({
        document,
        selection,
      });
      resultChannel.set(result);
    } catch (err) {
      if (err instanceof ErrorWithId) {
        outputChannel.appendLine(`${err.error} (${err.id})`);
      } else {
        outputChannel.appendLine(`${err}`);
      }
      if (
        err instanceof AuthenticationError ||
        err instanceof NoPageTokenError
      ) {
        window.showErrorMessage(`${err.message}`);
      }
    }
  };
}
