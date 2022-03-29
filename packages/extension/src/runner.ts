import { format as formatBytes } from "bytes";
import {
  createClient,
  createCSVFormatter,
  createFileOutput,
  createFlat,
  createJSONFormatter,
  createJSONLinesFormatter,
  createLogOutput,
  createMarkdownFormatter,
  createTableFormatter,
  createViewerOutput,
  DryRunJob,
  Formatter,
  Output,
  RunInfo,
  RunJob,
} from "core";
import { Results } from "core/src/types";
import { createWriteStream } from "fs";
import { readFile } from "fs/promises";
import mkdirp from "mkdirp";
import { basename, extname, join } from "path";
import {
  ExtensionContext,
  Range,
  TextDocument,
  Uri,
  WebviewPanel,
  window,
  workspace,
} from "vscode";
import { OutputChannel, Result } from ".";
import { Config } from "./config";
import { ConfigManager } from "./configManager";
import { ErrorMarker } from "./errorMarker";
import { StatusManager } from "./statusManager";

export type Runner = ReturnType<typeof createRunner>;
export type DryRunner = ReturnType<typeof createDryRunner>;

export function createRunner({
  outputChannel,
  outputManager,
  statusManager,
  runJobManager,
  renderer,
}: {
  readonly outputChannel: OutputChannel;
  readonly outputManager: OutputManager;
  readonly statusManager: StatusManager;
  readonly runJobManager: RunJobManager;
  readonly renderer: Renderer;
}) {
  return {
    async run({
      document,
      selection,
    }: {
      readonly document: TextDocument;
      readonly selection?: Range;
    }): Promise<Result> {
      let output!: Output;
      try {
        outputChannel.appendLine(`Run`);
        statusManager.loadBilled({
          document,
        });

        output = await outputManager.createOutput({ document });
        const path = await output.open();
        if (path !== undefined) {
          outputChannel.appendLine(`Output to: ${path}`);
        }

        const response = await runJobManager.rows({ document, selection });
        outputChannel.appendLine(`Job ID: ${response.jobId}`);
        await renderer.render({
          document,
          output,
          response,
        });

        return { jobId: response.jobId };
      } catch (err) {
        output.close();
        statusManager.errorBilled({ document });
        throw err;
      }
    },

    async gotoPrevPage({ document }: { readonly document: TextDocument }) {
      const output = await outputManager.createOutput({
        document,
      });
      const path = await output.open();
      if (path !== undefined) {
        outputChannel.appendLine(`Output to: ${path}`);
      }

      let response: RunJobResponse;
      try {
        response = await runJobManager.prevRows({ document });
      } catch (err) {
        output.close();
        throw err;
      }
      if (!response.results) {
        throw new ErrorWithId("no results", response.jobId);
      }

      await renderer.render({
        document,
        output,
        response,
      });

      return { jobId: response.jobId };
    },

    async gotoNextPage({ document }: { readonly document: TextDocument }) {
      const output = await outputManager.createOutput({
        document,
      });
      const path = await output.open();
      if (path !== undefined) {
        outputChannel.appendLine(`Output to: ${path}`);
      }

      let response: RunJobResponse;
      try {
        response = await runJobManager.nextRows({ document });
      } catch (err) {
        output.close();
        throw err;
      }
      if (!response.results) {
        throw new ErrorWithId("no results", response.jobId);
      }

      await renderer.render({
        document,
        output,
        response,
      });

      return { jobId: response.jobId };
    },

    onDidCloseTextDocument({ document }: { readonly document: TextDocument }) {
      outputManager.delete({ document });
      runJobManager.delete({ document });
    },

    dispose() {
      // do nothing
    },
  };
}

export function createDryRunner({
  outputChannel,
  configManager,
  statusManager,
  errorMarker,
}: {
  readonly outputChannel: OutputChannel;
  readonly configManager: ConfigManager;
  readonly statusManager: StatusManager;
  readonly errorMarker: ErrorMarker;
}) {
  return {
    async run({
      document,
      selection,
    }: {
      readonly document: TextDocument;
      readonly selection?: Range;
    }): Promise<Result> {
      try {
        outputChannel.appendLine(`Dry run`);
        statusManager.loadProcessed({
          document,
        });

        const config = configManager.get();
        const client = await createClient(config);

        let job!: DryRunJob;
        try {
          errorMarker.clear({ document });
          job = await client.createDryRunJob({
            query: getQueryText({ document, range: selection }),
          });
          errorMarker.clear({ document });
        } catch (err) {
          errorMarker.mark({ document, err, selection });
          throw err;
        }

        outputChannel.appendLine(`Job ID: ${job.id}`);
        const { totalBytesProcessed } = job.getInfo();
        const bytes = formatBytes(totalBytesProcessed);
        outputChannel.appendLine(`Result: ${bytes} estimated to be read`);

        statusManager.succeedProcessed({
          document,
          processed: {
            bytes,
          },
        });

        return { jobId: job.id };
      } catch (err) {
        statusManager.errorProcessed({ document });
        throw err;
      }
    },

    dispose() {
      // do nothing
    },
  };
}

export type OutputManager = ReturnType<typeof createOutputManager>;

export function createOutputManager({
  outputChannel,
  configManager,
  panelManager,
}: {
  readonly outputChannel: OutputChannel;
  readonly configManager: ConfigManager;
  readonly panelManager: PanelManager;
}) {
  return {
    async createOutput({
      document,
    }: {
      readonly document: TextDocument;
    }): Promise<Output> {
      const config = configManager.get();
      switch (config.output.type) {
        case "viewer": {
          const panel = await panelManager.get({ document });
          return createViewerOutput({
            postMessage: panel.webview.postMessage.bind(panel.webview),
          });
        }
        case "log":
          return createLogOutput({
            formatter: createFormatter({ config }),
            outputChannel,
          });
        case "file": {
          if (!workspace.workspaceFolders || !workspace.workspaceFolders[0]) {
            throw new Error(`no workspace folders`);
          }

          const formatter = createFormatter({ config });
          const dirname = join(
            workspace.workspaceFolders[0].uri.path ||
              workspace.workspaceFolders[0].uri.fsPath,
            config.output.file.path
          );
          const path = join(
            dirname,
            `${basename(
              document.fileName,
              extname(document.fileName)
            )}${formatToExtension(formatter.type)}`
          );
          const stream = createWriteStream(path, "utf-8");

          await mkdirp(dirname);
          return createFileOutput({
            formatter,
            stream,
          });
        }
      }
    },

    delete({ document }: { readonly document: TextDocument }) {
      panelManager.delete({ document });
    },

    dispose() {
      // do nothing
    },
  };
}

export type PanelManager = ReturnType<typeof createPanelManager>;

export function createPanelManager({
  ctx,
}: {
  readonly ctx: ExtensionContext;
}) {
  const map: Map<string, WebviewPanel> = new Map();

  return {
    async get({
      document,
    }: {
      readonly document: TextDocument;
    }): Promise<WebviewPanel> {
      const p = map.get(document.fileName);
      if (p) {
        p.reveal(undefined, true);
        return p;
      }

      const root = join(ctx.extensionPath, "out/viewer");
      const base = Uri.file(root)
        .with({
          scheme: "vscode-resource",
        })
        .toString();
      const html = (await readFile(join(root, "index.html"), "utf-8")).replace(
        "<head>",
        `<head><base href="${base}/" />`
      );
      const panel = window.createWebviewPanel(
        `bigqueryRunner:${document.fileName}`,
        basename(document.fileName),
        { viewColumn: -2, preserveFocus: true },
        {
          enableScripts: true,
          localResourceRoots: [Uri.file(root)],
        }
      );
      map.set(document.fileName, panel);
      panel.iconPath = Uri.file(
        join(ctx.extensionPath, "out/assets/icon-small.png")
      );
      panel.webview.html = html;
      panel.onDidDispose(() => {
        console.log("onDidDispose:", document.fileName);
        map.delete(document.fileName);
      });
      ctx.subscriptions.push(panel);
      return panel;
    },

    delete({ document }: { readonly document: TextDocument }) {
      map.delete(document.fileName);
    },

    dispose() {
      map.clear();
    },
  };
}

export type RunJobManager = ReturnType<typeof createRunJobManager>;

export type RunJobResponse = {
  jobId: string;
  results: Results;
  info: RunInfo;
};

export function createRunJobManager({
  configManager,
  errorMarker,
}: {
  readonly configManager: ConfigManager;
  readonly errorMarker: ErrorMarker;
}) {
  const map: Map<string, RunJob> = new Map();

  return {
    async rows({
      document,
      selection,
    }: {
      readonly document: TextDocument;
      readonly selection?: Range;
    }): Promise<RunJobResponse> {
      const config = configManager.get();
      const client = await createClient(config);
      let job: RunJob | undefined;
      try {
        errorMarker.clear({ document });
        job = await client.createRunJob({
          query: getQueryText({ document, range: selection }),
          maxResults: config.pagination.results,
        });
        errorMarker.clear({ document });
      } catch (err) {
        errorMarker.mark({ document, err, selection });
        throw err;
      }
      if (!job) {
        throw new Error(`no job`);
      }
      map.set(document.fileName, job);
      return {
        jobId: job.id,
        results: await job.getRows(),
        info: await job.getInfo(),
      };
    },

    async prevRows({
      document,
    }: {
      readonly document: TextDocument;
    }): Promise<RunJobResponse> {
      const job = map.get(document.fileName);
      if (!job) {
        throw new Error(`no job`);
      }
      return {
        jobId: job.id,
        results: await job.getPrevRows(),
        info: await job.getInfo(),
      };
    },

    async nextRows({
      document,
    }: {
      readonly document: TextDocument;
    }): Promise<RunJobResponse> {
      const job = map.get(document.fileName);
      if (!job) {
        throw new Error(`no job`);
      }
      return {
        jobId: job.id,
        results: await job.getNextRows(),
        info: await job.getInfo(),
      };
    },

    delete({ document }: { readonly document: TextDocument }) {
      return map.delete(document.fileName);
    },

    dispose() {
      map.clear();
    },
  };
}

export type Renderer = ReturnType<typeof createRenderer>;

export function createRenderer({
  outputChannel,
  statusManager,
}: {
  readonly outputChannel: OutputChannel;
  readonly statusManager: StatusManager;
}) {
  return {
    async render({
      document,
      output,
      response: {
        jobId,
        results,
        info: { query, schema, numRows },
      },
    }: {
      readonly document: TextDocument;
      readonly output: Output;
      readonly response: RunJobResponse;
    }) {
      try {
        statusManager.loadBilled({ document });

        outputChannel.appendLine(`Result: ${results.structs.length} rows`);
        const bytes = formatBytes(parseInt(query.totalBytesBilled, 10));
        outputChannel.appendLine(
          `Result: ${bytes} to be billed (cache: ${query.cacheHit})`
        );

        const flat = createFlat(schema.fields);
        await output.writeHeads({ flat });
        await output.writeRows({ ...results, numRows, flat });

        // const bytesWritten = await output.bytesWritten();
        // if (bytesWritten !== undefined) {
        //   outputChannel.appendLine(
        //     `Total bytes written: ${formatBytes(bytesWritten)}`
        //   );
        // }

        statusManager.succeedBilled({
          document,
          billed: { bytes, cacheHit: query.cacheHit },
        });
      } catch (err) {
        statusManager.errorBilled({ document });
        // statusManager.hide();
        if (jobId) {
          throw new ErrorWithId(err, jobId);
        } else {
          throw err;
        }
      }
    },

    dispose() {
      // do nothing
    },
  };
}

function formatToExtension(format: Formatter["type"]): string {
  return {
    table: ".txt",
    markdown: ".md",
    "json-lines": ".jsonl",
    json: ".json",
    csv: ".csv",
  }[format];
}

function createFormatter({ config }: { config: Config }): Formatter {
  switch (config.format.type) {
    case "table":
      return createTableFormatter();
    case "markdown":
      return createMarkdownFormatter();
    case "json-lines":
      return createJSONLinesFormatter();
    case "json":
      return createJSONFormatter();
    case "csv":
      return createCSVFormatter({ options: config.format.csv });
    default:
      throw new Error(`Invalid format: ${config.format.type}`);
  }
}

function getQueryText({
  document,
  range,
}: {
  readonly document: TextDocument;
  readonly range?: Range;
}): string {
  const text = range?.isEmpty ? document.getText() : document.getText(range);

  if (text.trim() === "") {
    throw new Error("text is empty");
  }

  return text;
}

export class ErrorWithId {
  constructor(public error: unknown, public id: string) {}
}
