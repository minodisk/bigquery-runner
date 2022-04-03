import { isAbsolute, join } from "path";
import { commands, workspace } from "vscode";
import { Config } from "./config";

export type ConfigManager = ReturnType<typeof createConfigManager>;

export function createConfigManager(section: string) {
  let config = getConfigration(section);
  setContext(config);
  return {
    get(): Config {
      return config;
    },
    refresh(): void {
      config = getConfigration(section);
      setContext(config);
    },
    dispose(): void {
      // do nothing
    },
  };
}

function getConfigration(section: string): Config {
  const config = workspace.getConfiguration(section) as unknown as Config;
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

function setContext(config: Config): void {
  const map = flatten(config, "bigqueryRunner");
  Object.keys(map).forEach((k) =>
    commands.executeCommand("setContext", k, map[k])
  );
}

function flatten(
  source: { [key: string]: any },
  parentKey: string,
  target: { [key: string]: any } = {}
): { [key: string]: any } {
  Object.keys(source).reduce((o, k) => {
    const v = source[k];
    const type = Object.prototype.toString.call(v);
    if (type === "[object Object]" && !Array.isArray(v)) {
      o = flatten(v, parentKey + "." + k, o);
    } else if (type !== "[object Function]") {
      o[parentKey + "." + k] = v;
    }
    return o;
  }, target);
  return target;
}
