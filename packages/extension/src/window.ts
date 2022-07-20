import { errorToString } from "types";
import type { Progress, ProgressOptions } from "vscode";
import { window } from "vscode";

export const showError = (err: unknown): void => {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  window.showErrorMessage(errorToString(err));
};

export const openProgress = (options: ProgressOptions) => {
  let close!: () => void;
  let progress!: Progress<{ message?: string; increment?: number }>;
  const taskPromise = new Promise((resolve) => {
    close = () => resolve(null);
  });
  const withProgressPromise = window.withProgress(options, async (prog) => {
    progress = prog;
    await taskPromise;
  });
  /* eslint-disable @typescript-eslint/no-floating-promises */
  (async () => {
    try {
      await withProgressPromise;
    } catch (err) {
      // ignore
    }
  })();
  /* eslint-enable */
  return {
    report: progress.report.bind(progress),
    close,
  };
};
