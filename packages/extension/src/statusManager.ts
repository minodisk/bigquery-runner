import { StatusBarAlignment, StatusBarItem, window } from "vscode";
import { Config } from "./config";

type State = "loading" | "error" | "success";

type Processed = { state: State; usage?: ProcessedUsage };

type ProcessedUsage = {
  bytes: string;
};

type Billed = { state: State; usage?: BilledUsage };

type BilledUsage = {
  bytes: string;
  cacheHit: boolean;
};

export type StatusManager = ReturnType<typeof createStatusManager>;

export function createStatusManager({
  options,
  createStatusBarItem,
}: {
  options: Config["statusBarItem"];
  createStatusBarItem: ReturnType<typeof createStatusBarItemCreator>;
}) {
  let statusBarItem = createStatusBarItem(options);
  const processedMap = new Map<string, Processed>();
  const billedMap = new Map<string, Billed>();

  return {
    loadProcessed({ fileName }: { fileName: string }) {
      const current = processedMap.get(fileName);
      processedMap.set(fileName, { ...current, state: "loading" });
      update({
        fileName,
        statusBarItem,
        processed: processedMap.get(fileName),
        billed: billedMap.get(fileName),
      });
    },
    errorProcessed({ fileName }: { fileName: string }) {
      const current = processedMap.get(fileName);
      processedMap.set(fileName, { ...current, state: "error" });
      update({
        fileName,
        statusBarItem,
        processed: processedMap.get(fileName),
        billed: billedMap.get(fileName),
      });
    },
    succeedProcessed({
      fileName,
      processed,
    }: {
      fileName: string;
      processed: ProcessedUsage;
    }) {
      processedMap.set(fileName, {
        state: "success",
        usage: processed,
      });
      update({
        fileName,
        statusBarItem,
        processed: processedMap.get(fileName),
        billed: billedMap.get(fileName),
      });
    },
    loadBilled({ fileName }: { fileName: string }) {
      const current = billedMap.get(fileName);
      billedMap.set(fileName, { ...current, state: "loading" });
      update({
        fileName,
        statusBarItem,
        processed: processedMap.get(fileName),
        billed: billedMap.get(fileName),
      });
    },
    errorBilled({ fileName }: { fileName: string }) {
      const current = billedMap.get(fileName);
      billedMap.set(fileName, { ...current, state: "error" });
      update({
        fileName,
        statusBarItem,
        processed: processedMap.get(fileName),
        billed: billedMap.get(fileName),
      });
    },
    succeedBilled({
      fileName,
      billed,
    }: {
      fileName: string;
      billed: BilledUsage;
    }) {
      billedMap.set(fileName, {
        state: "success",
        usage: billed,
      });
      update({
        fileName,
        statusBarItem,
        processed: processedMap.get(fileName),
        billed: billedMap.get(fileName),
      });
    },
    onFocus({ fileName }: { fileName: string }) {
      update({
        fileName,
        statusBarItem,
        processed: processedMap.get(fileName),
        billed: billedMap.get(fileName),
      });
    },
    hide() {
      statusBarItem.hide();
      statusBarItem.text = "";
      statusBarItem.tooltip = undefined;
    },
    updateOptions(options: Config["statusBarItem"]) {
      statusBarItem.dispose();
      statusBarItem = createStatusBarItem(options);
    },
    dispose() {
      statusBarItem.dispose();
      processedMap.forEach((_, key) => processedMap.delete(key));
      billedMap.forEach((_, key) => billedMap.delete(key));
    },
  };
}

export function createStatusBarItemCreator(w: typeof window) {
  return (options: Config["statusBarItem"]) => {
    return w.createStatusBarItem(
      options.align === "left"
        ? StatusBarAlignment.Left
        : options.align === "right"
        ? StatusBarAlignment.Right
        : undefined,
      options.priority
    );
  };
}

function update({
  fileName,
  statusBarItem,
  processed,
  billed,
}: {
  fileName: string;
  statusBarItem: StatusBarItem;
  processed?: Processed;
  billed?: Billed;
}) {
  if (fileName !== window.activeTextEditor?.document.fileName) {
    return;
  }

  statusBarItem.text = [
    getProcessedIcon(processed?.state),
    processed?.usage?.bytes,
    getBilledIcon(billed?.state),
    billed?.usage?.bytes,
  ].join(" ");
  statusBarItem.tooltip = [
    processed?.usage
      ? `This query will process ${processed.usage.bytes} when run.`
      : undefined,
    billed?.usage
      ? `In the last query that ran,
the cache ${billed.usage.cacheHit ? "was" : "wasn't"} applied and ${
          billed.usage.bytes
        } was the target of the bill.`
      : undefined,
  ].join("\n");
  statusBarItem.show();
}

function getProcessedIcon(state?: State) {
  switch (state) {
    case "loading":
      return "$(loading~spin)";
    case "error":
      return "$(error)";
    case "success":
      return "$(database)";
    default:
      return "";
  }
}

function getBilledIcon(state?: State) {
  switch (state) {
    case "loading":
      return "$(loading~spin)";
    case "error":
      return "$(error)";
    case "success":
      return "$(credit-card)";
    default:
      return "";
  }
}
