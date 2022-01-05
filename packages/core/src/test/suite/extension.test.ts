import { strictEqual } from "assert";
import { describe, it } from "mocha";
import { commands, languages, window, workspace } from "vscode";
import { activate, Result } from "../../extension";

// async function sleep(ms: number) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

describe("BigQuery Runner", () => {
  window.showInformationMessage("Start all tests.");

  const dependencies = (() => {
    let output = "";
    let result = {};
    const diagnosticCollection =
      languages.createDiagnosticCollection("bigqueryRunner");
    return {
      outputChannel: {
        // required interface
        append(value: string) {
          output += value;
        },
        appendLine(value: string) {
          output += value + "\n";
        },
        show() {},
        dispose() {},
        // for test
        get() {
          return output;
        },
      },
      resultChannel: {
        set(r: Result) {
          result = r;
        },
        get(): Result {
          return result;
        },
      },
      diagnosticCollection,
      clear() {
        output = "";
        result = {};
        diagnosticCollection.clear();
      },
    };
  })();

  describe("activation", () => {
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
  });

  describe("commands", () => {
    it("should be subscribed", async () => {
      const doc = await workspace.openTextDocument({
        language: "bigquery",
        content: `select * from (select 'a' as id)`,
      });
      await window.showTextDocument(doc);
      await commands.executeCommand("bigqueryRunner.run");
      const output = dependencies.outputChannel.get();
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
      dependencies.clear();
    });
  });

  //   describe("verification", () => {
  //     it("should run on file chaned", async () => {
  //       const config = workspace.getConfiguration("bigqueryRunner");
  //       await config.update("verifyOnSave.enabled", true, true);
  //       console.log("cofig:", config);

  //       dependencies.clear();

  //       const uri = Uri.joinPath(
  //         Uri.parse(__dirname),
  //         "../../../examples/error.bqsql"
  //       );
  //       console.log("->", uri);
  //       const document = await workspace.openTextDocument(uri);
  //       await window.showTextDocument(document);
  //       // await commands.executeCommand("bigqueryRunner.dryRun");

  //       await sleep(5000);

  //       const output = dependencies.outputChannel.get();
  //       const diagnostics = dependencies.diagnosticCollection.get(uri);
  //       console.log("->", diagnostics);

  //       // const { jobId } = dependencies.resultChannel.get();
  //       strictEqual(
  //         output,
  //         `Validate
  // Dry run
  // Error: Field 'ip' not found.

  // `
  //       );

  //       dependencies.clear();
  //     });
  //   });
});
