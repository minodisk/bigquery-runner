import {
  StatusBarAlignment,
  StatusBarItem,
  TextDocument,
  window,
} from "vscode";
import { Config } from "./config";

type Processed = {
  bytes: string;
};

type Billed = {
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
  let processedMap = new Map<
    string,
    { loading: boolean; status?: Processed }
  >();
  let billedMap = new Map<string, { loading: boolean; status?: Billed }>();

  return {
    enableProcessedLoading({ document }: { document: TextDocument }) {
      const current = processedMap.get(document.fileName);
      processedMap.set(document.fileName, { ...current, loading: true });
      update({
        document,
        statusBarItem,
        processed: processedMap.get(document.fileName),
        billed: billedMap.get(document.fileName),
      });
    },
    setProcessedState({
      document,
      processed,
    }: {
      document: TextDocument;
      processed: Processed;
    }) {
      processedMap.set(document.fileName, {
        loading: false,
        status: processed,
      });
      update({
        document,
        statusBarItem,
        processed: processedMap.get(document.fileName),
        billed: billedMap.get(document.fileName),
      });
    },
    enableBilledLoading({ document }: { document: TextDocument }) {
      const current = billedMap.get(document.fileName);
      billedMap.set(document.fileName, { ...current, loading: true });
      update({
        document,
        statusBarItem,
        processed: processedMap.get(document.fileName),
        billed: billedMap.get(document.fileName),
      });
    },
    setBilledState({
      document,
      billed,
    }: {
      document: TextDocument;
      billed: Billed;
    }) {
      billedMap.set(document.fileName, {
        loading: false,
        status: billed,
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
      processedMap = undefined!;
      billedMap.forEach((_, key) => billedMap.delete(key));
      billedMap = undefined!;
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
  processed?: { loading: boolean; status?: Processed };
  billed?: { loading: boolean; status?: Billed };
}) {
  if (document.fileName !== window.activeTextEditor?.document.fileName) {
    return;
  }

  statusBarItem.text = [
    processed?.loading
      ? `$(loading~spin)`
      : processed?.status
      ? `$(database)`
      : undefined,
    processed?.status?.bytes,
    billed?.loading
      ? `$(loading~spin)`
      : billed?.status
      ? `$(credit-card)`
      : undefined,
    billed?.status?.bytes,
  ].join(" ");
  statusBarItem.tooltip = [
    processed?.status
      ? `This query will process ${processed.status.bytes} when run.`
      : undefined,
    billed?.status
      ? `In the last query that ran,
the cache ${billed.status.cacheHit ? "was" : "wasn't"} applied and ${
          billed.status.bytes
        } was the target of the bill.`
      : undefined,
  ].join("\n");
  statusBarItem.show();
}
