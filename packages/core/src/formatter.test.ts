import {
  createCSVFormatter,
  createFlat,
  createJSONFormatter,
  createJSONLinesFormatter,
  createMarkdownFormatter,
} from ".";
import { createTableFormatter } from "./formatter";

describe("formatter", () => {
  describe("createTableFormatter", () => {
    it("should be format empty", async () => {
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      const formatter = createTableFormatter({
        flat,
      });
      expect(formatter.header()).toEqual("");
      expect(await formatter.rows([])).toEqual("\n");
      expect(formatter.footer()).toEqual("");
    });

    it("should be format simple", async () => {
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      const formatter = createTableFormatter({ flat });
      expect(formatter.header()).toEqual("");
      expect(
        await formatter.rows([
          {
            foo: 123,
          },
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
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      const formatter = createMarkdownFormatter({ flat });
      expect(formatter.header()).toEqual(
        `
|foo|
|---|
`.trimStart()
      );
      expect(await formatter.rows([])).toEqual("\n");
      expect(formatter.footer()).toEqual("");
    });

    it("should be format simple", async () => {
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      const formatter = createMarkdownFormatter({ flat });
      expect(formatter.header()).toEqual(
        `
|foo|
|---|
`.trimStart()
      );
      expect(
        await formatter.rows([
          {
            foo: 123,
          },
        ])
      ).toEqual(
        `
|123|
`.trimStart()
      );
      expect(formatter.footer()).toEqual("");
    });
  });

  describe("createJSONLinesFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createJSONLinesFormatter();
      expect(formatter.header()).toEqual("");
      expect(await formatter.rows([])).toEqual("\n");
      expect(formatter.footer()).toEqual("");
    });

    it("should be format simple", async () => {
      const formatter = createJSONLinesFormatter();
      expect(formatter.header()).toEqual("");
      expect(
        await formatter.rows([
          {
            foo: 123,
          },
        ])
      ).toEqual(
        `
{"foo":123}
`.trimStart()
      );
      expect(formatter.footer()).toEqual("");
    });
  });

  describe("createJSONFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createJSONFormatter();
      expect(formatter.header()).toEqual("[");
      expect(await formatter.rows([])).toEqual("");
      expect(formatter.footer()).toEqual(`]
`);
    });

    it("should be format simple", async () => {
      const formatter = createJSONFormatter();
      expect(formatter.header()).toEqual("[");
      expect(
        await formatter.rows([
          {
            foo: 123,
          },
        ])
      ).toEqual(`{"foo":123}`);
      expect(formatter.footer()).toEqual(`]
`);
    });
  });

  describe("createCSVFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createCSVFormatter({
        flat: createFlat([]),
        options: {},
      });
      expect(formatter.header()).toEqual("");
      expect(await formatter.rows([])).toEqual("");
      expect(formatter.footer()).toEqual(``);
    });

    it("should be format simple", async () => {
      const formatter = createCSVFormatter({
        flat: createFlat([
          { name: "a", type: "STRING", mode: "NULLABLE" },
          { name: "b", type: "STRING", mode: "NULLABLE" },
        ]),
        options: {},
      });
      expect(formatter.header()).toEqual("");
      expect(
        await formatter.rows([
          {
            a: "foo",
            b: "bar",
          },
          {
            a: "baz",
            b: "qux",
          },
        ])
      ).toEqual(`foo,bar
baz,qux
`);
      expect(formatter.footer()).toEqual(``);
    });
  });
});
