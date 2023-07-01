import type { TableReference } from "shared";
import { getTableName } from "shared";
import type { ConfigManager } from "./configManager";
import type { Logger } from "./logger";
import type { RunnerManager } from "./runner";

export type Previewer = ReturnType<typeof createPreviewer>;

export const createPreviewer = ({
  logger,
  configManager,
  runnerManager,
}: {
  logger: Logger;
  configManager: ConfigManager;
  runnerManager: RunnerManager;
}) => {
  return {
    async preview(tableReference: TableReference) {
      const id = getTableName(tableReference);
      const {
        previewer: { rowsPerPage },
      } = configManager.get();
      const query =
        `SELECT * FROM \`${id}\`` +
        (rowsPerPage ? ` LIMIT ${rowsPerPage}` : "");
      logger.log("query:", query);

      const runnerResult = await runnerManager.preview({
        title: tableReference.tableId,
        query,
        tableReference,
      });
      if (!runnerResult.success) {
        logger.error(runnerResult);
        return;
      }
      const runner = runnerResult.value;

      await runner.run();
    },

    dispose() {
      // do nothing
    },
  };
};
