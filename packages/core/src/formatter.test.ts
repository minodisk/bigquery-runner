import { createMarkdownFormatter } from ".";
import { createTableFormatter } from "./formatter";

describe("formatter", () => {
  describe("createTableFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createTableFormatter();
      expect(formatter.header([])).toEqual("");
      expect(await formatter.rows([])).toEqual("\n");
      expect(formatter.footer()).toEqual("");
    });

    it("should be format simple", async () => {
      const formatter = createTableFormatter();
      expect(
        formatter.header([
          { id: "foo", name: "foo", type: "INTEGER", mode: "NULLABLE" },
        ])
      ).toEqual("");
      expect(
        await formatter.rows([
          [
            {
              id: "foo",
              value: 123,
            },
          ],
        ])
      ).toEqual(
        `
foo
---
123
`.trimStart()
      );
      expect(formatter.footer()).toEqual("");
    });
  });

  describe("createMarkdownFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createMarkdownFormatter();
      expect(formatter.header([])).toEqual("");
      expect(await formatter.rows([])).toEqual("\n");
      expect(formatter.footer()).toEqual("");
    });

    it("should be format simple", async () => {
      const formatter = createMarkdownFormatter();
      expect(
        formatter.header([
          { id: "foo", name: "foo", type: "INTEGER", mode: "NULLABLE" },
        ])
      ).toEqual(
        `
|foo|
|---|
`.trimStart()
      );
      expect(
        await formatter.rows([
          [
            {
              id: "foo",
              value: 123,
            },
          ],
        ])
      ).toEqual(
        `
|123|
`.trimStart()
      );
      expect(formatter.footer()).toEqual("");
    });
  });

  //   describe("createJSONLinesFormatter", () => {
  //     it("should be format empty", async () => {
  //       const formatter = createJSONLinesFormatter();
  //       expect(formatter.header([])).toEqual("");
  //       expect(await formatter.rows([])).toEqual("\n");
  //       expect(formatter.footer()).toEqual("");
  //     });

  //     it("should be format simple", async () => {
  //       const formatter = createJSONLinesFormatter();
  //       expect(
  //         formatter.header([
  //           { id: "foo", name: "foo", type: "INTEGER", mode: "NULLABLE" },
  //         ])
  //       ).toEqual("");
  //       expect(
  //         await formatter.rows([
  //           [
  //             {
  //               id: "foo",
  //               value: 123,
  //             },
  //           ],
  //         ])
  //       ).toEqual(
  //         `
  // [123]
  // `.trimStart()
  //       );
  //       expect(formatter.footer()).toEqual("");
  //     });
  //   });

  //   describe("createJSONFormatter", () => {
  //     it("should be format empty", async () => {
  //       const formatter = createJSONFormatter();
  //       expect(formatter.header([])).toEqual("");
  //       expect(await formatter.rows([])).toEqual("\n");
  //       expect(formatter.footer()).toEqual("");
  //     });

  //     it("should be format simple", async () => {
  //       const formatter = createJSONFormatter();
  //       expect(
  //         formatter.header([
  //           { id: "foo", name: "foo", type: "INTEGER", mode: "NULLABLE" },
  //         ])
  //       ).toEqual("[");
  //       expect(
  //         await formatter.rows([
  //           [
  //             {
  //               id: "foo",
  //               value: 123,
  //             },
  //           ],
  //         ])
  //       ).toEqual(
  //         `
  // 123
  // `.trimStart()
  //       );
  //       expect(formatter.footer()).toEqual("]");
  //     });
  //   });
});
