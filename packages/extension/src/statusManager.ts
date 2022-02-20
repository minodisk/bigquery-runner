import {
  StatusBarAlignment,
  StatusBarItem,
  TextDocument,
  window,
} from "vscode";
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
    loadProcessed({ document }: { document: TextDocument }) {
      const current = processedMap.get(document.fileName);
      processedMap.set(document.fileName, { ...current, state: "loading" });
      update({
        document,
        statusBarItem,
        processed: processedMap.get(document.fileName),
        billed: billedMap.get(document.fileName),
      });
    },
    errorProcessed({ document }: { document: TextDocument }) {
      const current = processedMap.get(document.fileName);
      processedMap.set(document.fileName, { ...current, state: "error" });
      update({
        document,
        statusBarItem,
        processed: processedMap.get(document.fileName),
        billed: billedMap.get(document.fileName),
      });
    },
    succeedProcessed({
      document,
      processed,
    }: {
      document: TextDocument;
      processed: ProcessedUsage;
    }) {
      processedMap.set(document.fileName, {
        state: "success",
        usage: processed,
      });
      update({
        document,
        statusBarItem,
        processed: processedMap.get(document.fileName),
        billed: billedMap.get(document.fileName),
      });
    },
    loadBilled({ document }: { document: TextDocument }) {
      const current = billedMap.get(document.fileName);
      billedMap.set(document.fileName, { ...current, state: "loading" });
      update({
        document,
        statusBarItem,
        processed: processedMap.get(document.fileName),
        billed: billedMap.get(document.fileName),
      });
    },
    errorBilled({ document }: { document: TextDocument }) {
      const current = billedMap.get(document.fileName);
      billedMap.set(document.fileName, { ...current, state: "error" });
      update({
        document,
        statusBarItem,
        processed: processedMap.get(document.fileName),
        billed: billedMap.get(document.fileName),
      });
    },
    succeedBilled({
      document,
      billed,
    }: {
      document: TextDocument;
      billed: BilledUsage;
    }) {
      billedMap.set(document.fileName, {
        state: "success",
        usage: billed,
      });
      update({
        document,
        statusBarItem,
        processed: processedMap.get(document.fileName),
        billed: billedMap.get(document.fileName),
      });
    },
    onFocus({ document }: { document: TextDocument }) {
      update({
        document,
        statusBarItem,
        processed: processedMap.get(document.fileName),
        billed: billedMap.get(document.fileName),
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
export type StatusManager = ReturnType<typeof createStatusManager>;

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
  document,
  statusBarItem,
  processed,
  billed,
}: {
  document: TextDocument;
  statusBarItem: StatusBarItem;
  processed?: Processed;
  billed?: Billed;
}) {
  if (document.fileName !== window.activeTextEditor?.document.fileName) {
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
