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

import { createGcloud } from "core";
import { errorToString, tabs, unwrap } from "shared";
import type { ExtensionContext } from "vscode";
import { commands, window, workspace } from "vscode";
import { createConfigManager } from "./configManager";
import { createDownloader } from "./downloader";
import { createDryRunner } from "./dryRunner";
import { createErrorManager } from "./errorManager";
import { createErrorMarkerManager } from "./errorMarker";
import { createLogger } from "./logger";
import { createParamManager } from "./paramManager";
import { createPreviewer } from "./previewer";
import { createQuickFixManager } from "./quickfix";
import { createRendererManager } from "./renderer";
import { createRunnerManager } from "./runner";
import {
  createStatusBarItemCreator,
  createStatusManager,
} from "./statusManager";
import type { FieldElement, TableElement } from "./tree";
import { createTree } from "./tree";
import { showError, showInformation } from "./window";

export async function activate(ctx: ExtensionContext) {
  try {
    const title = "BigQuery Runner";
    const section = "bigqueryRunner";

    const logger = createLogger(window.createOutputChannel(title));
    const configManager = createConfigManager(section);
    const statusManager = createStatusManager({
      configManager,
      createStatusBarItem: createStatusBarItemCreator(window),
    });
    const downloader = createDownloader({
      logger: logger.createChild("downloader"),
      configManager,
      statusManager,
    });
    const rendererManager = createRendererManager({
      ctx,
      logger: logger.createChild("renderer"),
      configManager,
      async onPrevPageRequested({ renderer: { runnerId } }) {
        await runnerManager.get(runnerId)?.movePage(-1);
      },
      async onNextPageRequested({ renderer: { runnerId } }) {
        await runnerManager.get(runnerId)?.movePage(1);
      },
      async onDownloadRequested({ renderer: { runnerId }, event: { format } }) {
        const runner = runnerManager.get(runnerId);
        if (!runner) {
          return;
        }
        await downloader.downloadWithQuery({
          format,
          query: runner.query,
        });
      },
      async onPreviewRequested({
        event: {
          payload: { tableReference },
        },
      }) {
        await previewer.preview(tableReference);
      },
      async onDidDisposePanel({ runnerId }) {
        runnerManager.get(runnerId)?.dispose();
      },
    });

    const gcloud = createGcloud({
      logger,
    });

    const errorManager = createErrorManager({
      logger: logger.createChild("errorManager"),
      gcloud,
    });
    const errorMarkerManager = createErrorMarkerManager(section);
    const quickFixManager = createQuickFixManager({ configManager });

    const paramManager = createParamManager({ state: ctx.globalState, logger });

    const runnerManager = createRunnerManager({
      logger: logger.createChild("runner"),
      configManager,
      statusManager,
      paramManager,
      rendererManager,
      errorManager,
      errorMarkerManager,
    });
    const dryRunner = createDryRunner({
      logger: logger.createChild("dryRunner"),
      configManager,
      statusManager,
      errorManager,
      errorMarkerManager,
      quickFixManager,
    });

    const previewer = createPreviewer({
      logger: logger.createChild("previewer"),
      configManager,
      runnerManager,
    });
    const tree = createTree({
      logger: logger.createChild("tree"),
      configManager,
      previewer,
    });

    ctx.subscriptions.push(
      logger,
      configManager,
      downloader,
      rendererManager,
      statusManager,
      gcloud,
      errorManager,
      errorMarkerManager,
      quickFixManager,
      paramManager,
      runnerManager,
      dryRunner,
      previewer,
      tree
    );

    // Register all available commands and their actions.
    // CommandMap describes a map of extension commands (defined in package.json)
    // and the function they invoke.
    ctx.subscriptions.push(
      ...Object.entries({
        [`${section}.login`]: async () => {
          const res = await gcloud.login();
          if (!res.success) {
            showError(`Login failure: ${errorToString(res.value)}`);
            return;
          }
          showInformation(`Login success`);
        },
        [`${section}.logout`]: async () => {
          const res = await gcloud.logout();
          if (!res.success) {
            showError(`Logout failure: ${errorToString(res.value)}`);
            return;
          }
          showInformation(`Logout success`);
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
        [`${section}.dryRun`]: async () => {
          if (!window.activeTextEditor) {
            return;
          }
          await dryRunner.run(window.activeTextEditor);
        },
        [`${section}.refreshResources`]: async () => {
          await tree.refreshResources();
        },
        [`${section}.deleteSelectedResources`]: async () => {
          await tree.deleteSelectedResources();
        },
        [`${section}.copyTableId`]: async (element: TableElement) => {
          await tree.copyTableId(element);
        },
        [`${section}.previewTableInVSCode`]: async (element: TableElement) => {
          await tree.previewTableInVSCode(element);
        },
        [`${section}.previewTableOnRemote`]: async (element: TableElement) => {
          await tree.previewTableOnRemote(element);
        },
        [`${section}.copyFieldName`]: async (element: FieldElement) => {
          await tree.copyFieldName(element);
        },
        [`${section}.clearParams`]: async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          const runnerResult = await runnerManager.getWithEditor(
            window.activeTextEditor
          );
          if (!runnerResult.success) {
            return;
          }
          await runnerResult.value.clearParams();
        },
        [`${section}.clearAllParams`]: async () => {
          await paramManager.clearAllParams();
        },
      }).map(([name, action]) => commands.registerCommand(name, action))
    );

    ctx.subscriptions.push(
      ...[
        {
          name: "prev",
          diff: -1,
        },
        {
          name: "next",
          diff: 1,
        },
      ].map(({ name, diff }) =>
        commands.registerCommand(`${section}.${name}Page`, async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          const runner = runnerManager.findWithFileName(
            window.activeTextEditor.document.fileName
          );
          if (!runner) {
            return;
          }
          await runner.movePage(diff);
        })
      )
    );

    ctx.subscriptions.push(
      ...[
        {
          name: "Left",
          diff: -1,
        },
        {
          name: "Right",
          diff: 1,
        },
      ].map(({ name, diff }) =>
        commands.registerCommand(`${section}.focusOn${name}Tab`, async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          const runner = runnerManager.findWithFileName(
            window.activeTextEditor.document.fileName
          );
          if (!runner) {
            return;
          }
          await runner.moveFocusTab(diff);
        })
      )
    );

    ctx.subscriptions.push(
      ...tabs.map((name) =>
        commands.registerCommand(`${section}.focusOn${name}Tab`, async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          const runner = runnerManager.findWithFileName(
            window.activeTextEditor.document.fileName
          );
          if (!runner) {
            return;
          }
          await runner.focusOnTab(name);
        })
      )
    );

    ctx.subscriptions.push(
      ...[
        {
          name: "JSONL",
          format: "jsonl" as const,
        },
        {
          name: "JSON",
          format: "json" as const,
        },
        {
          name: "CSV",
          format: "csv" as const,
        },
        {
          name: "Markdown",
          format: "md" as const,
        },
        {
          name: "Text",
          format: "txt" as const,
        },
      ].map(({ name, format }) =>
        commands.registerCommand(`${section}.downloadAs${name}`, async () => {
          if (!window.activeTextEditor) {
            throw new Error(`no active text editor`);
          }
          await downloader.downloadWithEditor({
            format,
            editor: window.activeTextEditor,
          });
        })
      )
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
