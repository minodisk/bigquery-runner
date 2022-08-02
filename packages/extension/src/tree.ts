import type { Client } from "core";
import { createClient } from "core";
import type {
  DatasetReference,
  ProjectID,
  ProjectReference,
  TableReference,
} from "shared";
import type { Disposable, TreeItem } from "vscode";
import { EventEmitter, TreeItemCollapsibleState, window } from "vscode";
import type { ConfigManager } from "./configManager";
import type { Logger } from "./logger";
import type { Previewer } from "./previewer";

export type Element = ProjectElement | DatasetElement | TableElement;
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
  previewTable(): Promise<void>;
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
              label: ref.datasetId,
              ref,
              collapsibleState: TreeItemCollapsibleState.Collapsed,
            };
            return elem;
          });
        }

        if (element.contextValue === "dataset") {
          const client = clients.get(element.ref.projectId);
          if (!client) {
            return [];
          }
          const tables = await client.getTables(element.label);
          return tables.map((ref) => {
            const id = `${ref.projectId}:${ref.datasetId}.${ref.tableId}`;
            const elem: TableElement = {
              contextValue: "table",
              id,
              tooltip: id,
              label: ref.tableId,
              command: {
                title: "Preview Table",
                command: "bigqueryRunner.previewTable",
                arguments: [ref],
              },
              ref,
              collapsibleState: TreeItemCollapsibleState.None,
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
      console.log("refreshResources:", tree.selection);
      emitter.fire(null);
    },

    async deleteSelectedResources() {
      console.log("deleteSelectedResources:", tree.selection);
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
      console.log("deleteSelectedResources:", "complete");
      await this.refreshResources();
    },

    async previewTable() {
      console.log("previewTable:", tree.selection);
      await Promise.all(
        tree.selection
          .filter((e): e is TableElement => e.contextValue === "table")
          .map((e) => previewer.preview(e.ref))
      );
    },

    dispose() {
      clients.clear();
      emitter.dispose();
      tree.dispose();
      removeListener.dispose();
    },
  };
};
