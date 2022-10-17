import { errorToString } from "shared";
import type { OutputChannel } from "vscode";

export type Logger = ReturnType<typeof createLogger>;

export const createLogger = (chan: OutputChannel) => {
  const createChild = (prefixes: string[]) => {
    return {
      log(...messages: string[]) {
        chan.appendLine([prefix(prefixes), ...messages].join(" "));
      },
      error(err: unknown) {
        chan.appendLine(
          [prefix(prefixes), "Error:", errorToString(err)].join(" ")
        );
      },
      createChild(prefix: string) {
        return createChild([...prefixes, prefix]);
      },
      dispose() {
        // do nothing
      },
    };
  };

  return createChild([]);
};

const prefix = (prefixes: Array<string>): string =>
  prefixes.map((p) => `[${p}]`).join("");
