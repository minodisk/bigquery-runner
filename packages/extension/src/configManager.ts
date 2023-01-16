import { isAbsolute, join } from "path";
import type { Disposable } from "vscode";
import { commands, workspace } from "vscode";
import type { OrigConfig } from "./OrigConfig";

export type ConfigManager = ReturnType<typeof createConfigManager>;

export type Config = Omit<OrigConfig, "defaultDataset" | "compiler"> & {
  defaultDataset?: OrigConfig["defaultDataset"];
  libsRoot: string;
};

type Callback = (config: Config) => unknown;

export function createConfigManager(section: string) {
  let config = getConfig(section);
  setContext(config);

  const callbacks = new Set<Callback>();

  const subscriptions = [
    workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(section)) {
        return;
      }

      config = getConfig(section);
      setContext(config);

      callbacks.forEach((cb) => cb(config));
    }),
  ];

  return {
    get(): Config {
      return config;
    },

    onChange(callback: Callback): Disposable {
      callbacks.add(callback);
      return {
        dispose() {
          callbacks.delete(callback);
        },
      };
    },

    dispose(): void {
      subscriptions.forEach((s) => s.dispose());
      callbacks.clear();
    },
  };
}

function getAbsolute(fileName?: string): string | undefined {
  return fileName === undefined || fileName === null
    ? undefined
    : isAbsolute(fileName) ||
      !workspace.workspaceFolders ||
      !workspace.workspaceFolders[0] ||
      workspace.workspaceFolders.length === 0
    ? fileName
    : join(workspace.workspaceFolders[0].uri.fsPath, fileName);
}

function getConfig(section: string): Config {
  const config = workspace.getConfiguration(section) as unknown as OrigConfig;
  return {
    ...config,
    defaultDataset:
      config.defaultDataset.datasetId || config.defaultDataset.projectId
        ? config.defaultDataset
        : undefined,
    downloader: {
      ...config.downloader,
      rowsPerPage:
        config.downloader.rowsPerPage === undefined ||
        config.downloader.rowsPerPage === null
          ? undefined
          : config.downloader.rowsPerPage,
    },
    keyFilename: getAbsolute(config.keyFilename),
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
    viewer: {
      ...config.viewer,
      rowsPerPage:
        config.viewer.rowsPerPage === undefined ||
        config.viewer.rowsPerPage === null
          ? undefined
          : config.viewer.rowsPerPage,
    },
    libsRoot: getAbsolute(config.compiler.libsRoot) ?? "",
  };
}

function setContext(config: Config): void {
  const map = flatten(config, "bigqueryRunner");
  Object.keys(map).forEach((k) =>
    commands.executeCommand("setContext", k, map[k])
  );
}

function flatten(
  source: { [key: string]: unknown },
  parentKey: string,
  target: { [key: string]: unknown } = {}
): { [key: string]: unknown } {
  return Object.keys(source).reduce((t, k) => {
    const v = source[k];
    const type = Object.prototype.toString.call(v);
    if (type === "[object Object]" && !Array.isArray(v)) {
      t = flatten(v as { [key: string]: unknown }, parentKey + "." + k, t);
    } else if (type !== "[object Function]") {
      t[parentKey + "." + k] = v;
    }
    return t;
  }, target);
}
