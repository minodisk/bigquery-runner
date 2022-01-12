import { createViewerOutput, WebviewPanel } from "./output";

describe("formatter", () => {
  describe("createViewerOutput", () => {
    it("should be format", async () => {
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
            onDidDispose() {},
          };
        },
      });
      await formatter.open();
      await formatter.writeHeads([
        { id: "foo", name: "foo", type: "BOOLEAN", mode: "REQUIRED" },
      ]);
      await formatter.writeRows([
        [
          {
            id: "foo",
            value: true,
          },
        ],
      ]);
      await formatter.close();
    });
  });
});
