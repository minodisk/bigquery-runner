import type { Err, Result } from "shared";
import { errorToString, tryCatch } from "shared";
import type { Progress, ProgressOptions } from "vscode";
import { window } from "vscode";

export const showError = (
  err: unknown,
  callbacks: { [label: string]: () => unknown } = {}
): void => {
  const cbs = new Map(Object.entries(callbacks));
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    const key = await window.showErrorMessage(
      errorToString(err),
      ...cbs.keys()
    );
    if (!key) {
      return;
    }
    const callback = cbs.get(key);
    if (!callback) {
      return;
    }
    callback();
  })();
};

export const showInformation = (
  message: string,
  callbacks: { [label: string]: () => unknown } = {}
): void => {
  const cbs = new Map(Object.entries(callbacks));
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    const key = await window.showInformationMessage(message, ...cbs.keys());
    if (!key) {
      return;
    }
    const callback = cbs.get(key);
    if (!callback) {
      return;
    }
    callback();
  })();
};

export const openProgress = (options: ProgressOptions) => {
  let close!: () => Promise<Result<Err<"Unknown">, void>>;
  let progress!: Progress<{ message?: string; increment?: number }>;
  const taskPromise = new Promise((resolve) => {
    close = async () => {
      resolve(null);
      return uiPromise;
    };
  });
  const uiPromise = tryCatch(
    async () =>
      window.withProgress(options, async (prog) => {
        progress = prog;
        await taskPromise;
      }),
    (err) => ({
      type: "Unknown" as const,
      reason: errorToString(err),
    })
  );
  return {
    report: progress.report.bind(progress),
    close,
  };
};
