import { createFlat, createLogOutput, createMarkdownFormatter } from ".";
import { createViewerOutput, WebviewPanel } from "./output";

describe("formatter", () => {
  describe("createViewerOutput", () => {
    it("should be format", async () => {
      const flat = createFlat([
        { name: "foo", type: "BOOLEAN", mode: "REQUIRED" },
      ]);
      const messages: Array<unknown> = [];
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
            dispose() {
              // do nothing
            },
            onDidDispose() {
              // do nothing
            },
          };
        },
      });
      await output.open();
      await output.writeHeads({ flat });
      await output.writeRows({
        structs: [
          {
            foo: true,
          },
        ],
        numRows: "0",
        flat,
      });
      expect(messages).toEqual([
        {
          source: "bigquery-runner",
          payload: {
            event: "open",
          },
        },
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
        let actual = "";
        const output = createLogOutput({
          formatter: createMarkdownFormatter(),
          outputChannel: {
            show() {
              // do nothing
            },
            append(value) {
              actual += value;
            },
          },
        });
        await output.open();
        await output.writeHeads({
          flat,
        });
        await output.writeRows({
          structs: [
            {
              foo: true,
            },
          ],
          numRows: "0",
          flat,
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
