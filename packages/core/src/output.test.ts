import { createFlat } from ".";
import { createViewerOutput, WebviewPanel } from "./output";

describe("formatter", () => {
  describe("createViewerOutput", () => {
    it("should be format", async () => {
      const flat = createFlat([
        { name: "foo", type: "BOOLEAN", mode: "REQUIRED" },
      ]);
      const formatter = createViewerOutput({
        html: "",
        subscriptions: [],
        createWebviewPanel(): WebviewPanel {
          return {
            webview: {
              html: "",
              async postMessage() {
                return true;
              },
            },
            dispose() {},
            onDidDispose() {},
          };
        },
        flat,
      });
      await formatter.open();
      await formatter.writeHeads();
      await formatter.writeRows({
        rows: [
          {
            foo: true,
          },
        ],
        numRows: "0",
      });
      await formatter.close();
    });
  });
});
