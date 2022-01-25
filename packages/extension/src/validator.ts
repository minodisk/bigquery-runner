import { DiagnosticCollection, TextDocument } from "vscode";
import { OutputChannel } from ".";
import { ConfigManager } from "./configManager";
import { createErrorMarker } from "./errorMarker";
import { isBigQuery } from "./isBigQuery";
import { DryRunner, ErrorWithId } from "./runner";

export function createValidator({
  diagnosticCollection,
  outputChannel,
  configManager,
  dryRunner,
}: {
  readonly diagnosticCollection: DiagnosticCollection;
  readonly outputChannel: OutputChannel;
  readonly configManager: ConfigManager;
  readonly dryRunner: DryRunner;
}) {
  let pathTimeoutId = new Map<string, NodeJS.Timeout>();

  async function exec({
    document,
  }: {
    readonly document: TextDocument;
  }): Promise<void> {
    try {
      outputChannel.appendLine(`Validate`);
      await dryRunner.run({
        errorMarker: createErrorMarker({ diagnosticCollection, document }),
        document,
      });
    } catch (err) {
      if (err instanceof ErrorWithId) {
        outputChannel.appendLine(`${err.error} (${err.id})`);
      } else {
        outputChannel.appendLine(`${err}`);
      }
    }
  }

  return {
    async validate({
      document,
    }: {
      readonly document: TextDocument;
    }): Promise<void> {
      const config = configManager.get();
      if (
        !isBigQuery({ config, document }) ||
        !config.queryValidation.enabled
      ) {
        return;
      }

      const timeoutId = pathTimeoutId.get(document.uri.path);
      if (timeoutId) {
        clearTimeout(timeoutId);
        pathTimeoutId.delete(document.uri.path);
      }
      pathTimeoutId.set(
        document.uri.path,
        setTimeout(
          () =>
            exec({
              document,
            }),
          config.queryValidation.debounceInterval
        )
      );
    },

    dispose() {
      pathTimeoutId.forEach((timeoutId, key) => {
        clearTimeout(timeoutId);
        pathTimeoutId.delete(key);
      });
      pathTimeoutId = undefined!;
    },
  };
}
