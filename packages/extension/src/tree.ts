import path from "path";
import type { Client } from "core";
import { createClient } from "core";
import type {
  DatasetReference,
  FieldMode,
  FieldReference,
  FieldType,
  ProjectID,
  ProjectReference,
  TableReference,
} from "shared";
import type { Disposable, TreeItem } from "vscode";
import {
  ThemeColor,
  ThemeIcon,
  EventEmitter,
  TreeItemCollapsibleState,
  window,
} from "vscode";
import type { ConfigManager } from "./configManager";
import type { Logger } from "./logger";
import type { Previewer } from "./previewer";

export type Element =
  | ProjectElement
  | DatasetElement
  | TableElement
  | FieldElement;
export type ProjectElement = TreeItem & {
  contextValue: "project";
  id: string;
  label: string;
  ref: ProjectReference;
  collapsibleState: TreeItemCollapsibleState;
};
export type DatasetElement = TreeItem & {
  contextValue: "dataset";
  id: string;
  label: string;
  ref: DatasetReference;
  collapsibleState: TreeItemCollapsibleState;
};
export type TableElement = TreeItem & {
  contextValue: "table";
  id: string;
  label: string;
  ref: TableReference;
  collapsibleState: TreeItemCollapsibleState;
};

export type FieldElement = TreeItem & {
  contextValue: "field";
  id: string;
  label: string;
  ref: FieldReference;
  collapsibleState: TreeItemCollapsibleState;
};

export const createTree = ({
  logger,
  configManager,
  previewer,
}: {
  logger: Logger;
  configManager: ConfigManager;
  previewer: Previewer;
}): Disposable & {
  refreshResources(): Promise<void>;
  deleteSelectedResources(): Promise<void>;
  previewTable(element: TableElement): Promise<void>;
} => {
  const clients = new Map<ProjectID, Client>();
  const emitter = new EventEmitter<null>();
  const removeListener = configManager.onChange(() => {
    clients.clear();
    emitter.fire(null);
  });

  const tree = window.createTreeView<Element>("bigqueryRunner.resources", {
    // canSelectMany: true,
    // {
    //   "command": "bigqueryRunner.deleteSelectedResources",
    //   "title": "BigQuery Runner: Delete Selected Resources",
    //   "icon": "$(trash)",
    //   "description": "Delete a selected dataset in the BigQuery Runner's Resources view"
    // },
    // "view/item/context": [
    //   {
    //     "command": "bigqueryRunner.deleteSelectedResources",
    //     "when": "view == bigqueryRunner.resources && viewItem == dataset || viewItem == table",
    //     "group": "inline"
    //   }
    // ]

    treeDataProvider: {
      onDidChangeTreeData: emitter.event,

      async getChildren(element?: Element): Promise<Array<Element>> {
        const config = configManager.get();

        if (clients.size === 0) {
          const clientResult = await createClient({
            keyFilename: config.keyFilename,
            projectId: config.projectId,
            location: config.location,
          });
          if (!clientResult.success) {
            logger.error(clientResult);
            return [];
          }
          const defaultClient = clientResult.value;
          const defaultProjectId = await defaultClient.getProjectId();
          clients.set(defaultProjectId, defaultClient);

          const projectIdsSet = new Set(config.tree.projectIds);
          projectIdsSet.delete(defaultProjectId);
          await Promise.all(
            Array.from(projectIdsSet).map(async (projectId) => {
              const clientResult = await createClient({
                keyFilename: config.keyFilename,
                projectId,
              });
              if (!clientResult.success) {
                logger.error(clientResult);
                return;
              }
              clients.set(projectId, clientResult.value);
            })
          );
        }

        if (!element) {
          return Array.from(clients.keys()).map((projectId) => {
            const id = `${projectId}`;
            const elem: ProjectElement = {
              contextValue: "project",
              id,
              tooltip: id,
              label: projectId,
              ref: { projectId },
              collapsibleState: TreeItemCollapsibleState.Collapsed,
            };
            return elem;
          });
        }

        if (element.contextValue === "project") {
          const client = clients.get(element.ref.projectId);
          if (!client) {
            return [];
          }
          const datasets = await client.getDatasets();
          return datasets.map((ref) => {
            const id = `${ref.projectId}:${ref.datasetId}`;
            const elem: DatasetElement = {
              contextValue: "dataset",
              id,
              tooltip: id,
              iconPath: path.join(__dirname, "../assets/dataset.svg"),
              label: ref.datasetId,
              ref,
              collapsibleState: TreeItemCollapsibleState.Collapsed,
            };
            return elem;
          });
        }

        if (element.contextValue === "dataset") {
          console.log("table:", element.ref);
          const client = clients.get(element.ref.projectId);
          if (!client) {
            return [];
          }
          const tables = await client.getTables(element.ref);
          return tables.map((ref) => {
            const id = `${ref.projectId}:${ref.datasetId}.${ref.tableId}`;
            const elem: TableElement = {
              contextValue: "table",
              id,
              tooltip: id,
              iconPath: path.join(__dirname, "../assets/table.svg"),
              label: ref.tableId,
              ref,
              collapsibleState: TreeItemCollapsibleState.Collapsed,
            };
            return elem;
          });
        }

        if (element.contextValue === "table") {
          console.log("field:", element.ref);
          const client = clients.get(element.ref.projectId);
          if (!client) {
            return [];
          }
          const fields = await client.getFields(element.ref);
          console.log("fields:", fields);
          return fields.map((ref) => {
            const id = `${ref.projectId}:${ref.datasetId}.${ref.tableId}::${ref.fieldId}`;
            const elem: FieldElement = {
              contextValue: "field",
              id,
              tooltip: id,
              label: ref.name,
              description: ref.type,
              iconPath: iconPath(ref),
              ref,
              collapsibleState: ref.fields
                ? TreeItemCollapsibleState.Expanded
                : TreeItemCollapsibleState.None,
            };
            return elem;
          });
        }

        if (element.contextValue === "field" && element.ref.fields) {
          return element.ref.fields.map((ref) => {
            const id = `${ref.projectId}:${ref.datasetId}.${ref.tableId}::${ref.fieldId}`;
            const elem: FieldElement = {
              contextValue: "field",
              id,
              tooltip: id,
              label: ref.name,
              description: ref.type,
              iconPath: iconPath(ref),
              ref,
              collapsibleState: ref.fields
                ? TreeItemCollapsibleState.Expanded
                : TreeItemCollapsibleState.None,
            };
            return elem;
          });
        }

        return [];
      },

      async getTreeItem(element: Element): Promise<TreeItem> {
        return element;
      },
    },
  });

  return {
    async refreshResources() {
      emitter.fire(null);
    },

    async deleteSelectedResources() {
      await Promise.all([
        ...tree.selection
          .filter(
            (elem): elem is DatasetElement => elem.contextValue === "dataset"
          )
          .map(async ({ ref }) => {
            const client = clients.get(ref.projectId);
            if (!client) {
              return;
            }
            await client.deleteDataset(ref.datasetId);
          }),
        ...tree.selection
          .filter((elem): elem is TableElement => elem.contextValue === "table")
          .map(async ({ ref }) => {
            const client = clients.get(ref.projectId);
            if (!client) {
              return;
            }
            await client.deleteTable(ref);
          }),
      ]);
      await this.refreshResources();
    },

    async previewTable(element: TableElement) {
      await previewer.preview(element.ref);
    },

    dispose() {
      clients.clear();
      emitter.dispose();
      tree.dispose();
      removeListener.dispose();
    },
  };
};

const iconPath = ({
  type,
  mode,
}: {
  type?: FieldType;
  mode?: FieldMode;
}): ThemeIcon => {
  const color = new ThemeColor("foreground");
  if (mode === "REPEATED") {
    return new ThemeIcon("symbol-array", color);
  }
  switch (type) {
    case "RECORD":
    case "STRUCT":
      return new ThemeIcon("symbol-object", color);
    case "STRING":
    case "BYTES":
      return new ThemeIcon("symbol-string", color);
    case "INTEGER":
    case "INT64":
    case "FLOAT":
    case "FLOAT64":
    case "NUMERIC":
    case "BIGNUMERIC":
      return new ThemeIcon("symbol-number", color);
    case "BOOLEAN":
    case "BOOL":
      return new ThemeIcon("symbol-boolean", color);
    case "TIMESTAMP":
    case "DATETIME":
    case "DATE":
      return new ThemeIcon("calendar", color);
    case "TIME":
      return new ThemeIcon("clock", color);
    case "INTERVAL":
      return new ThemeIcon("watch", color);
    default:
      return new ThemeIcon("symbol-value", color);
  }
};
