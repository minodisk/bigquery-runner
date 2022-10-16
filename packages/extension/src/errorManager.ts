import { spawn } from "child_process";
import type { AuthenticationError, NoProjectIDError } from "core";
import type { Err } from "shared";
import { commands, env, Uri } from "vscode";
import type { Logger } from "./logger";
import { showError } from "./window";

export type ErrorManager = ReturnType<typeof createErrorManager>;

export const createErrorManager = ({ logger }: { logger: Logger }) => {
  const isAuthenticationError = (
    err: Err<string>
  ): err is AuthenticationError => err.type === "Authentication";
  const isNoProjectIDError = (err: Err<string>): err is NoProjectIDError =>
    err.type === "NoProjectID";

  const showAuthenticationError = (err: AuthenticationError) => {
    showError(err.reason, {
      ...(err.hasKeyFilename
        ? {
            "User settings": async () =>
              commands.executeCommand("workbench.action.openSettingsJson"),
            "Workspace settings": async () =>
              commands.executeCommand(
                "workbench.action.openWorkspaceSettingsFile"
              ),
          }
        : {
            Login: async () => {
              const login = spawn("gcloud", [
                "auth",
                "application-default",
                "login",
              ]);
              login.stdout.on("data", (data) => logger.log(`stdout: ${data}`));
              login.stderr.on("data", (data) => logger.log(`stderr: ${data}`));
              login.on("close", (code) => logger.log(`close: ${code}`));
            },
          }),
      "More information": async () => {
        await env.openExternal(
          Uri.parse(
            "https://github.com/minodisk/bigquery-runner/blob/main/README.md#authentication"
          )
        );
      },
    });
  };

  const showNoProjectIDError = (err: NoProjectIDError) => {
    showError(err.reason, {
      "User settings": async () =>
        commands.executeCommand("workbench.action.openSettingsJson"),
      "Workspace settings": async () =>
        commands.executeCommand("workbench.action.openWorkspaceSettingsFile"),
      "More information": async () => {
        await env.openExternal(
          Uri.parse(
            "https://github.com/minodisk/bigquery-runner/blob/main/README.md#bigqueryrunnerprojectid"
          )
        );
      },
    });
  };

  return {
    show(err: Err<string>) {
      if (isAuthenticationError(err)) {
        showAuthenticationError(err);
        return;
      }
      if (isNoProjectIDError(err)) {
        showNoProjectIDError(err);
        return;
      }
      showError(err);
    },

    dispose() {
      // do nothing
    },
  };
};
