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

import { unwrap } from "types";
import { commands, ExtensionContext, window, workspace } from "vscode";
import { createConfigManager } from "./configManager";
import { createDownloader } from "./downloader";
import { createDryRunner } from "./dryRunner";
import { createErrorMarkerManager } from "./errorMarker";
import { createLogger } from "./logger";
import { createRendererManager } from "./renderer";
import { createRunnerManager } from "./runner";
import {
  createStatusBarItemCreator,
  createStatusManager,
} from "./statusManager";

export async function activate(ctx: ExtensionContext) {
  try {
    const title = "BigQuery Runner";
    const section = "bigqueryRunner";

    const logger = createLogger(window.createOutputChannel(title));
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
      logger: logger.createChild("renderer"),
      configManager,
      async onPrevPageRequested({ runnerId }) {
        await runnerManager.get(runnerId)?.prev();
      },
      async onNextPageRequested({ runnerId }) {
        await runnerManager.get(runnerId)?.next();
      },
      async onDownloadRequested({ runnerId }) {
        await runnerManager.get(runnerId)?.download();
      },
      async onPreviewRequested({ runnerId }) {
        await runnerManager.get(runnerId)?.preview();
      },
      async onDidDisposePanel({ runnerId }) {
        runnerManager.get(runnerId)?.dispose();
      },
    });
    const errorMarkerManager = createErrorMarkerManager(section);
    const runnerManager = createRunnerManager({
      logger: logger.createChild("runner"),
      configManager,
      statusManager,
      rendererManager,
      downloader,
      errorMarkerManager,
    });
    const dryRunner = createDryRunner({
      logger: logger.createChild("dryRunner"),
      configManager,
      statusManager,
      errorMarkerManager,
    });
    ctx.subscriptions.push(
      logger,
      configManager,
      downloader,
      rendererManager,
      statusManager,
      errorMarkerManager,
      runnerManager,
      dryRunner
    );

    // Register all available commands and their actions.
    // CommandMap describes a map of extension commands (defined in package.json)
    // and the function they invoke.
    ctx.subscriptions.push(
      ...Object.entries({
        [`${section}.dryRun`]: async () => {
          if (!window.activeTextEditor) {
            return;
          }
          await dryRunner.run(window.activeTextEditor);
        },
        [`${section}.run`]: async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          const runnerResult = await runnerManager.getWithEditor(
            window.activeTextEditor
          );
          if (!runnerResult.success) {
            return;
          }
          await unwrap(runnerResult).run();
        },
        [`${section}.prevPage`]: async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          const runner = runnerManager.findWithFileName(
            window.activeTextEditor.document.fileName
          );
          if (!runner) {
            return;
          }
          await runner.prev();
        },
        [`${section}.nextPage`]: async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          const runner = runnerManager.findWithFileName(
            window.activeTextEditor.document.fileName
          );
          if (!runner) {
            return;
          }
          await runner.next();
        },
      }).map(([name, action]) => commands.registerCommand(name, action))
    );

    window.visibleTextEditors.forEach((editor) => dryRunner.validate(editor));
    ctx.subscriptions.push(
      window.onDidChangeActiveTextEditor(async (editor) => {
        if (!editor) {
          return;
        }
        await dryRunner.validate(editor);
      }),
      workspace.onDidOpenTextDocument((document) =>
        dryRunner.validateWithDocument(document)
      ),
      workspace.onDidChangeTextDocument(({ document }) =>
        dryRunner.validateWithDocument(document)
      ),
      workspace.onDidSaveTextDocument((document) =>
        dryRunner.validateWithDocument(document)
      ),
      workspace.onDidCloseTextDocument((document) => {
        const runner = runnerManager.findWithFileName(document.fileName);
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
