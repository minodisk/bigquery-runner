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

import { commands, ExtensionContext, window, workspace } from "vscode";
import { createConfigManager } from "./configManager";
import { createDownloader } from "./downloader";
import { createDryRunner } from "./dryRunner";
import { createErrorMarker } from "./errorMarker";
import { isBigQuery } from "./isBigQuery";
import { createRendererManager, Renderer } from "./renderer";
import { createRunner } from "./runner";
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

    const onDidDisposePanel = (renderer: Renderer) => {
      runner.onDidDisposePanel(renderer);
    };

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
      statusManager,
      onPrevPageRequested() {
        runner.gotoPrevPage();
      },
      onNextPageRequested() {
        runner.gotoNextPage();
      },
      onDownloadRequested(renderer) {
        runner.download(renderer);
      },
      onPreviewRequested(renderer) {
        runner.preview(renderer);
      },
      onDidDisposePanel,
    });
    const errorMarker = createErrorMarker({
      section,
    });
    const runner = createRunner({
      configManager,
      outputChannel,
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
        () => {
          if (!window.activeTextEditor) {
            return;
          }
          dryRunner.run({ document: window.activeTextEditor.document });
        },
      ],
      [`${section}.run`, runner.run],
      [`${section}.prevPage`, runner.gotoPrevPage],
      [`${section}.nextPage`, runner.gotoNextPage],
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

        statusManager.onFocus({ fileName: editor.document.fileName });
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
      workspace.onDidCloseTextDocument((document) => {
        runner.onDidCloseTextDocument({ fileName: document.fileName });
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
    window.showErrorMessage(`${err}`);
  }
}

export function deactivate() {
  // do nothing
}
