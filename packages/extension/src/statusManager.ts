import type { RunnerID } from "shared";
import type { window } from "vscode";
import { StatusBarAlignment } from "vscode";
import type { Config, ConfigManager } from "./configManager";

export type StatusManager = ReturnType<typeof createStatusManager>;
export type Status = Readonly<{
  loadProcessed(): void;
  errorProcessed(): void;
  succeedProcessed(usage: ProcessedUsage): void;
  loadBilled(): void;
  errorBilled(): void;
  succeedBilled(usage: BilledUsage): void;
  show(): void;
}>;

type State = "ready" | "loading" | "error" | "success";

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
  configManager,
  createStatusBarItem,
}: {
  configManager: ConfigManager;
  createStatusBarItem: ReturnType<typeof createStatusBarItemCreator>;
}) {
  const statuses = new Map<RunnerID, Status>();

  let statusBarItem = createStatusBarItem(configManager.get().statusBarItem);
  const subscriptions = [
    configManager.onChange((config) => {
      statusBarItem.dispose();
      statusBarItem = createStatusBarItem(config.statusBarItem);
    }),
  ];

  const statusManager = {
    get(runnerId: RunnerID): Status {
      const s = statuses.get(runnerId);
      if (s) {
        return s;
      }

      const status = create();
      statuses.set(runnerId, status);
      return status;
    },

    hide() {
      statusBarItem.hide();
      statusBarItem.text = "";
      statusBarItem.tooltip = undefined;
    },

    dispose() {
      subscriptions.forEach((s) => s.dispose());
      statusBarItem.dispose();
      statuses.clear();
    },
  };

  const create = () => {
    const processed: Processed = {
      state: "ready",
      usage: {
        bytes: "",
      },
    };
    const billed: Billed = {
      state: "ready",
      usage: {
        bytes: "",
        cacheHit: false,
      },
    };

    const apply = () => {
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
    };

    return {
      loadProcessed() {
        processed.state = "loading";
        apply();
      },
      errorProcessed() {
        processed.state = "error";
        apply();
      },
      succeedProcessed(usage: ProcessedUsage) {
        processed.state = "success";
        processed.usage = usage;
        apply();
      },
      loadBilled() {
        billed.state = "loading";
        apply();
      },
      errorBilled() {
        billed.state = "error";
        apply();
      },
      succeedBilled(usage: BilledUsage) {
        billed.state = "success";
        billed.usage = usage;
        apply();
      },
      show() {
        apply();
      },
    };
  };

  return statusManager;
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
