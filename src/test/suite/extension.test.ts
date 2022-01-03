import { strictEqual } from "assert";
import { describe, it } from "mocha";
import { commands, window, workspace } from "vscode";
import { activate, Result } from "../../extension";

describe("activate", () => {
  window.showInformationMessage("Start all tests.");

  let output = "";
  let result = {};
  const dependencies = {
    outputChannel: {
      append(value: string) {
        output += value;
      },
      appendLine(value: string) {
        output += value + "\n";
      },
      show() {},
      dispose() {},
    },
    resultChannel: {
      set(r: Result) {
        result = r;
      },
      get(): Result {
        return result;
      },
    },
  };

  it("should push disposable to subscriptions", async () => {
    const subscriptions: Array<{ dispose(): any }> = [];
    await activate(
      {
        subscriptions,
      },
      dependencies
    );
    strictEqual(subscriptions.length, 9);
  });

  describe("commands", () => {
    it("should be subscribed", async () => {
      const doc = await workspace.openTextDocument({
        language: "bigquery",
        content: `select * from (select 'a' as id)`,
      });
      await window.showTextDocument(doc);
      await commands.executeCommand("bigqueryRunner.run");
      const { jobId } = dependencies.resultChannel.get();
      strictEqual(
        output,
        `Run
Job ID: ${jobId}
Result: 1 rows
id
--
a

`
      );
    });
  });
});
