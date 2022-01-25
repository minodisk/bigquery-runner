import { isAbsolute, join } from "path";
import { workspace } from "vscode";
import { Config } from "./config";

export type ConfigManager = ReturnType<typeof createConfigManager>;

export function createConfigManager(section: string) {
  let config = getConfigration(section);
  return {
    get(): Config {
      return config;
    },
    refresh(): void {
      config = getConfigration(section);
    },
    dispose(): void {
      // do nothing
    },
  };
}

function getConfigration(section: string): Config {
  const config = workspace.getConfiguration(section) as any as Config;
  return {
    ...config,
    pagination: {
      results:
        config.pagination?.results === undefined ||
        config.pagination?.results === null
          ? undefined
          : config.pagination.results,
    },
    keyFilename:
      config.keyFilename === null || config.keyFilename === undefined
        ? undefined
        : isAbsolute(config.keyFilename) ||
          !workspace.workspaceFolders ||
          !workspace.workspaceFolders[0] ||
          workspace.workspaceFolders.length === 0
        ? config.keyFilename
        : join(workspace.workspaceFolders[0].uri.fsPath, config.keyFilename),
    statusBarItem: {
      align:
        config.statusBarItem.align === null ||
        config.statusBarItem.align === undefined
          ? undefined
          : config.statusBarItem.align,
      priority:
        config.statusBarItem.priority === null ||
        config.statusBarItem.priority === undefined
          ? undefined
          : config.statusBarItem.priority,
    },
  };
}
