import type { AuthenticationError, Gcloud, NoProjectIDError } from "core";
import type { Err } from "shared";
import { errorToString } from "shared";
import { commands, env, Uri } from "vscode";
import type { Logger } from "./logger";
import { showError, showInformation } from "./window";

export type ErrorManager = ReturnType<typeof createErrorManager>;

export const createErrorManager = ({
  logger,
  gcloud,
}: {
  logger: Logger;
  gcloud: Gcloud;
}) => {
  const l = logger.createChild("ErrorManager");
  const isAuthenticationError = (
    err: Err<string>
  ): err is AuthenticationError => err.type === "Authentication";
  const isNoProjectIDError = (err: Err<string>): err is NoProjectIDError =>
    err.type === "NoProjectID";

  const userSettings = async () => {
    l.log("open user settings");
    await commands.executeCommand("workbench.action.openSettingsJson");
  };
  const workspaceSettings = async () => {
    l.log("open workspace settings");
    await commands.executeCommand("workbench.action.openWorkspaceSettingsFile");
  };
  const login = async () => {
    l.log("login");
    const res = await gcloud.login();
    if (!res.success) {
      showError(`Login failure: ${errorToString(res.value)}`);
      return;
    }
    showInformation(`Login success`);
  };
  const moreInformation = async () => {
    l.log("open more information");
    await env.openExternal(
      Uri.parse(
        "https://github.com/minodisk/bigquery-runner/blob/main/README.md#authentication"
      )
    );
  };

  const showAuthenticationError = (err: AuthenticationError) => {
    showError(err.reason, {
      ...(err.hasKeyFilename
        ? {
            "User settings": userSettings,
            "Workspace settings": workspaceSettings,
          }
        : {
            Login: login,
          }),
      "More information": moreInformation,
    });
  };

  const showNoProjectIDError = (err: NoProjectIDError) => {
    showError(err.reason, {
      "User settings": userSettings,
      "Workspace settings": workspaceSettings,
      "More information": moreInformation,
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
