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

import { basename } from "path";
import { commands, ExtensionContext, window, workspace } from "vscode";
import { createConfigManager } from "./configManager";
import { createDownloader } from "./downloader";
import { createDryRunner } from "./dryRunner";
import { createErrorMarker } from "./errorMarker";
import { getQueryText } from "./getQueryText";
import { isBigQuery } from "./isBigQuery";
import { createRendererManager } from "./renderer";
import { createRunnerManager } from "./runner";
import {
  createStatusBarItemCreator,
  createStatusManager,
} from "./statusManager";
import { createValidator } from "./validator";

export type Result = {
  readonly jobId?: string;
};

export async function activate(ctx: ExtensionContext) {
  try {
    const title = "BigQuery Runner";
    const section = "bigqueryRunner";

    const outputChannel = window.createOutputChannel(title);
    const configManager = createConfigManager(section);
    const downloader = createDownloader({
      configManager,
    });
    const statusManager = createStatusManager({
      options: configManager.get().statusBarItem,
      createStatusBarItem: createStatusBarItemCreator(window),
    });
    const rendererManager = createRendererManager({
      ctx,
      configManager,
      outputChannel,
      async onPrevPageRequested({ runnerId }) {
        await runnerManager.get({ runnerId })?.prev();
      },
      async onNextPageRequested({ runnerId }) {
        await runnerManager.get({ runnerId })?.next();
      },
      async onDownloadRequested({ runnerId }) {
        await runnerManager.get({ runnerId })?.download();
      },
      async onPreviewRequested({ runnerId }) {
        await runnerManager.get({ runnerId })?.preview();
      },
      async onDidDisposePanel({ runnerId }) {
        await runnerManager.get({ runnerId })?.dispose();
      },
    });
    const errorMarker = createErrorMarker({
      section,
    });
    const runnerManager = createRunnerManager({
      configManager,
      outputChannel,
      statusManager,
      rendererManager,
      downloader,
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
      outputChannel,
      configManager,
      downloader,
      rendererManager,
      statusManager,
      errorMarker,
      runnerManager,
      dryRunner,
      validator
    );

    // Register all available commands and their actions.
    // CommandMap describes a map of extension commands (defined in package.json)
    // and the function they invoke.
    new Map<string, () => void>([
      [
        `${section}.dryRun`,
        async () => {
          if (!window.activeTextEditor) {
            return;
          }
          await dryRunner.run({ document: window.activeTextEditor.document });
        },
      ],
      [
        `${section}.run`,
        async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          const { document, selections, viewColumn } = window.activeTextEditor;
          const query = await getQueryText({
            document,
            selections,
          });
          await runnerManager.create({
            query,
            title: basename(document.fileName),
            fileName: document.fileName,
            selections,
            baseViewColumn: viewColumn,
          });
        },
      ],
      [
        `${section}.prevPage`,
        async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          const runner = runnerManager.findWithFileName({
            fileName: window.activeTextEditor.document.fileName,
          });
          if (!runner) {
            return;
          }
          await runner.prev();
        },
      ],
      [
        `${section}.nextPage`,
        async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          const runner = runnerManager.findWithFileName({
            fileName: window.activeTextEditor.document.fileName,
          });
          if (!runner) {
            return;
          }
          await runner.next();
        },
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
      window.onDidChangeActiveTextEditor(async (editor) => {
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

        statusManager.onFocus({ fileName: editor.document.fileName });
        await validator.validate({
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
      workspace.onDidCloseTextDocument((document) => {
        const runner = runnerManager.findWithFileName({
          fileName: document.fileName,
        });
        if (!runner) {
          return;
        }
        runner.dispose();
      }),
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
    // show leaked error
    await window.showErrorMessage(`${err}`);
  }
}

export function deactivate() {
  // do nothing
}
