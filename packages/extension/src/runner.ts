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
  Results,
  RunJob,
} from "core";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  ExtensionContext,
  Range,
  TextDocument,
  Uri,
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
  ctx,
  outputChannel,
  configManager,
  statusManager,
  errorMarker,
}: {
  readonly ctx: ExtensionContext;
  readonly outputChannel: OutputChannel;
  readonly configManager: ConfigManager;
  readonly statusManager: StatusManager;
  readonly errorMarker: ErrorMarker;
}) {
  let job: RunJob | undefined;

  async function renderRows({
    document,
    output,
    results,
  }: {
    readonly document: TextDocument;
    readonly output: Output;
    readonly results: Results;
  }) {
    if (!job) {
      throw new Error(`no job`);
    }

    try {
      statusManager.enableBilledLoading({ document });

      outputChannel.appendLine(`Result: ${results.rows.length} rows`);
      const { query, schema, numRows } = await job.getInfo();
      const bytes = formatBytes(parseInt(query.totalBytesBilled, 10));
      outputChannel.appendLine(
        `Result: ${bytes} to be billed (cache: ${query.cacheHit})`
      );

      const flat = createFlat(schema.fields);
      await output.writeHeads({ flat });
      await output.writeRows({ ...results, numRows, flat });
      const bytesWritten = await output.bytesWritten();
      if (bytesWritten !== undefined) {
        outputChannel.appendLine(
          `Total bytes written: ${formatBytes(bytesWritten)}`
        );
      }

      statusManager.setBilledState({
        document,
        billed: { bytes, cacheHit: query.cacheHit },
      });
    } catch (err) {
      statusManager.hide();
      if (job.id) {
        throw new ErrorWithId(err, job.id);
      } else {
        throw err;
      }
    }
  }

  return {
    async run({
      document,
      range,
    }: {
      readonly document: TextDocument;
      readonly range?: Range;
    }): Promise<Result> {
      outputChannel.appendLine(`Run`);

      const config = configManager.get();

      const output = await createOutput({
        config,
        outputChannel,
        filename: document.fileName,
        ctx,
      });
      const path = await output.open();
      if (path !== undefined) {
        outputChannel.appendLine(`Output to: ${path}`);
      }

      try {
        errorMarker.clear({ document });
        statusManager.enableBilledLoading({
          document,
        });

        const client = await createClient(config);
        job = await client.createRunJob({
          query: getQueryText({ document, range }),
          maxResults: config.pagination.results,
        });
        outputChannel.appendLine(`Job ID: ${job.id}`);

        errorMarker.clear({ document });
      } catch (err) {
        output.close();
        statusManager.hide();
        errorMarker.mark({ document, err });
      }

      if (!job) {
        throw new Error(`no job`);
      }

      const results = await job.getRows();
      await renderRows({
        document,
        output,
        results,
      });
      return { jobId: job.id };
    },

    async gotoPrevPage({ document }: { readonly document: TextDocument }) {
      if (!job) {
        throw new Error(`no job`);
      }

      const config = configManager.get();
      const output = await createOutput({
        config,
        outputChannel,
        filename: document.fileName,
        ctx,
      });
      const path = await output.open();
      if (path !== undefined) {
        outputChannel.appendLine(`Output to: ${path}`);
      }

      let results: Results;
      try {
        results = await job.getPrevRows();
      } catch (err) {
        output.close();
        throw err;
      }
      if (!results) {
        throw new ErrorWithId("no results", job.id);
      }

      await renderRows({
        document,
        output,
        results,
      });

      return { jobId: job.id };
    },

    async gotoNextPage({ document }: { readonly document: TextDocument }) {
      if (!job) {
        throw new Error(`no job`);
      }

      const config = configManager.get();
      const output = await createOutput({
        config,
        outputChannel,
        filename: document.fileName,
        ctx,
      });
      const path = await output.open();
      if (path !== undefined) {
        outputChannel.appendLine(`Output to: ${path}`);
      }

      let results: Results;
      try {
        results = await job.getNextRows();
      } catch (err) {
        output.close();
        throw err;
      }
      if (!results) {
        throw new ErrorWithId("no results", job.id);
      }

      await renderRows({
        document,
        output,
        results,
      });

      return { jobId: job.id };
    },

    dispose() {
      job = undefined;
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
      range,
    }: {
      readonly document: TextDocument;
      readonly range?: Range;
    }): Promise<Result> {
      outputChannel.appendLine(`Dry run`);

      statusManager.enableProcessedLoading({
        document,
      });

      const config = configManager.get();
      const client = await createClient(config);

      let job!: DryRunJob;
      try {
        errorMarker.clear({ document });
        job = await client.createDryRunJob({
          query: getQueryText({ document, range }),
        });
        errorMarker.clear({ document });
      } catch (err) {
        errorMarker.mark({ document, err });
      }

      outputChannel.appendLine(`Job ID: ${job.id}`);
      const { totalBytesProcessed } = job.getInfo();
      const bytes = formatBytes(totalBytesProcessed);
      outputChannel.appendLine(`Result: ${bytes} estimated to be read`);

      statusManager.setProcessedState({
        document,
        processed: {
          bytes,
        },
      });

      return { jobId: job.id };
    },

    dispose() {
      // do nothing
    },
  };
}

async function createOutput({
  config,
  outputChannel,
  filename,
  ctx,
}: {
  readonly config: Config;
  readonly outputChannel: OutputChannel;
  readonly filename: string;
  readonly ctx: ExtensionContext;
}): Promise<Output> {
  switch (config.output.type) {
    case "viewer": {
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
      return createViewerOutput({
        html,
        subscriptions: ctx.subscriptions,
        createWebviewPanel: () => {
          const panel = window.createWebviewPanel(
            "bigqueryRunner",
            "BigQuery Runner",
            { viewColumn: -2, preserveFocus: true },
            {
              enableScripts: true,
              localResourceRoots: [Uri.file(root)],
            }
          );
          ctx.subscriptions.push(panel);
          return panel;
        },
      });
    }
    case "log":
      return createLogOutput({
        formatter: createFormatter({ config }),
        outputChannel,
      });
    case "file":
      if (!workspace.workspaceFolders || !workspace.workspaceFolders[0]) {
        throw new Error(`no workspace folders`);
      }
      return createFileOutput({
        formatter: createFormatter({ config }),
        dirname: join(
          workspace.workspaceFolders[0].uri.path ||
            workspace.workspaceFolders[0].uri.fsPath,
          config.output.file.path
        ),
        filename,
      });
  }
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
