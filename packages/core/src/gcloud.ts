import { spawn } from "child_process";
import type { Logger } from "extension/src/logger";
import { errorToString, tryCatch } from "shared";

export type Gcloud = ReturnType<typeof createGcloud>;

export const createGcloud = ({ logger }: { logger: Logger }) => {
  const l = logger.createChild("Gcloud");
  const gcloud = (args: ReadonlyArray<string>) => {
    return new Promise<Array<string>>((resolve, reject) => {
      const stream = spawn("gcloud", args);
      const outs: Array<string> = [];
      const errs: Array<string> = [];
      stream.stdout.on("data", (data) => {
        l.log(`stdout: ${data}`);
        outs.push(data);
      });
      stream.stderr.on("data", (data) => {
        l.log(`stderr: ${data}`);
        errs.push(data);
      });
      stream.on("close", (code) => {
        l.log(`close: ${code}`);
        if (code !== 0) {
          reject(errs);
          return;
        }
        resolve(outs);
      });
    });
  };
  return {
    async login() {
      return tryCatch(
        () => gcloud(["auth", "application-default", "login"]),
        (err) => ({
          type: "LoginFailed",
          message: errorToString(err),
        })
      );
    },

    async logout() {
      return tryCatch(
        () => gcloud(["auth", "application-default", "revoke", "--quiet"]),
        (err) => ({
          type: "LogoutFailed",
          message: errorToString(err),
        })
      );
    },

    dispose() {
      // do nothing
    },
  };
};
