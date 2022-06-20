import { OutputChannel, TextDocument } from "vscode";
import { ConfigManager } from "./configManager";
import { DryRunner } from "./dryRunner";
import { isBigQuery } from "./isBigQuery";
import { ErrorWithId } from "./runner";

export function createValidator({
  outputChannel,
  configManager,
  dryRunner,
}: {
  readonly outputChannel: OutputChannel;
  readonly configManager: ConfigManager;
  readonly dryRunner: DryRunner;
}) {
  const pathTimeoutId = new Map<string, NodeJS.Timeout>();

  return {
    async validate({
      document,
    }: {
      readonly document: TextDocument;
    }): Promise<void> {
      const config = configManager.get();
      if (!isBigQuery({ config, document }) || !config.validation.enabled) {
        return;
      }

      const timeoutId = pathTimeoutId.get(document.uri.path);
      if (timeoutId) {
        clearTimeout(timeoutId);
        pathTimeoutId.delete(document.uri.path);
      }
      pathTimeoutId.set(
        document.uri.path,
        setTimeout(async () => {
          try {
            outputChannel.appendLine(`Validate`);
            await dryRunner.run({ document });
          } catch (err) {
            if (err instanceof ErrorWithId) {
              outputChannel.appendLine(`${err.error} (${err.id})`);
            } else {
              outputChannel.appendLine(`${err}`);
            }
          }
        }, config.validation.debounceInterval)
      );
    },

    dispose() {
      pathTimeoutId.forEach((timeoutId, key) => {
        clearTimeout(timeoutId);
        pathTimeoutId.delete(key);
      });
    },
  };
}
