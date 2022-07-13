import { errorToString } from "types";
import type { OutputChannel } from "vscode";

export type Logger = ReturnType<typeof createLogger>;

export const createLogger = (chan: OutputChannel) => {
  const createChild = (names: string[]) => {
    return {
      log(...messages: string[]) {
        chan.appendLine([...names.map((n) => `[${n}]`), ...messages].join(" "));
      },
      error(err: unknown) {
        chan.appendLine(
          [...names.map((n) => `[${n}]`), "Error:", errorToString(err)].join(
            " "
          )
        );
      },
      createChild(name: string) {
        return createChild([...names, name]);
      },
      dispose() {
        // do nothing
      },
    };
  };

  return createChild([]);
};
