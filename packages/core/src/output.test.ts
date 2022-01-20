import { createFlat, createLogOutput, createMarkdownFormatter } from ".";
import { createViewerOutput, WebviewPanel } from "./output";

describe("formatter", () => {
  describe("createViewerOutput", () => {
    it("should be format", async () => {
      const flat = createFlat([
        { name: "foo", type: "BOOLEAN", mode: "REQUIRED" },
      ]);
      const messages: Array<any> = [];
      const output = createViewerOutput({
        html: "",
        subscriptions: [],
        createWebviewPanel(): WebviewPanel {
          return {
            webview: {
              html: "",
              async postMessage(message) {
                messages.push(message);
                return true;
              },
            },
            dispose() {},
            onDidDispose() {},
          };
        },
        flat,
      });
      await output.open();
      await output.writeHeads();
      await output.writeRows({
        rows: [
          {
            foo: true,
          },
        ],
        numRows: "0",
      });
      await output.close();
      expect(messages).toEqual([
        {
          source: "bigquery-runner",
          payload: {
            event: "rows",
            payload: {
              header: ["foo"],
              rows: [
                {
                  rowNumber: 1,
                  rows: [
                    [
                      {
                        id: "foo",
                        value: true,
                      },
                    ],
                  ],
                },
              ],
              page: undefined,
              numRows: "0",
            },
          },
        },
      ]);
    });
  });

  describe("createLogOutput", () => {
    describe("format markdown", () => {
      it("should be output", async () => {
        const flat = createFlat([
          { name: "foo", type: "BOOLEAN", mode: "REQUIRED" },
        ]);
        let actual: string = "";
        const output = createLogOutput({
          formatter: createMarkdownFormatter({
            flat,
          }),
          outputChannel: {
            show() {},
            append(value) {
              actual += value;
            },
          },
        });
        await output.open();
        await output.writeHeads();
        await output.writeRows({
          rows: [
            {
              foo: true,
            },
          ],
          numRows: "0",
        });
        await output.close();
        expect(actual).toEqual(
          `|foo|
|---|
|true|
`
        );
      });
    });
  });
});
