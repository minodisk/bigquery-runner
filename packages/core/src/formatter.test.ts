import {
  createCSVFormatter,
  createFlat,
  createJSONFormatter,
  createJSONLinesFormatter,
  createMarkdownFormatter,
  createTableFormatter,
} from ".";

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
      expect(await formatter.rows({ structs: [], rowNumber: 0 })).toEqual("\n");
      expect(formatter.footer()).toEqual("");
    });

    it("should be format simple", async () => {
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      const formatter = createTableFormatter({ flat });
      expect(formatter.header()).toEqual("");
      expect(
        await formatter.rows({
          structs: [
            {
              foo: 123,
            },
          ],
          rowNumber: 0,
        })
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
      expect(await formatter.rows({ structs: [], rowNumber: 0 })).toEqual("\n");
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
        await formatter.rows({
          structs: [
            {
              foo: 123,
            },
          ],
          rowNumber: 0,
        })
      ).toEqual(
        `
|123|
`.trimStart()
      );
      expect(formatter.footer()).toEqual("");
    });

    it("should be format complex", async () => {
      const flat = createFlat([
        { name: "a", type: "INTEGER", mode: "NULLABLE" },
        {
          name: "b",
          type: "STRUCT",
          mode: "REPEATED",
          fields: [
            { name: "c", type: "FLOAT", mode: "NULLABLE" },
            { name: "d", type: "STRING", mode: "NULLABLE" },
          ],
        },
        { name: "e", type: "BOOLEAN", mode: "NULLABLE" },
      ]);
      const formatter = createMarkdownFormatter({ flat });
      expect(formatter.header()).toEqual(
        `
|a|b.c|b.d|e|
|---|---|---|---|
`.trimStart()
      );
      expect(
        await formatter.rows({
          structs: [
            {
              a: 123,
              b: [
                {
                  c: 0.456,
                  d: "foo",
                },
                {
                  c: 0.789,
                  d: "bar",
                },
              ],
              e: true,
            },
            {
              a: 987,
              b: [
                {
                  c: 0.65,
                  d: "foo",
                },
                {
                  c: 0.43,
                  d: "bar",
                },
                {
                  c: 0.21,
                  d: "baz",
                },
              ],
              e: false,
            },
          ],
          rowNumber: 0,
        })
      ).toEqual(
        `
|123|0.456|foo|true|
||0.789|bar||
|987|0.65|foo|false|
||0.43|bar||
||0.21|baz||
`.trimStart()
      );
      expect(formatter.footer()).toEqual("");
    });
  });

  describe("createJSONLinesFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createJSONLinesFormatter();
      expect(formatter.header()).toEqual("");
      expect(await formatter.rows({ structs: [], rowNumber: 0 })).toEqual("\n");
      expect(formatter.footer()).toEqual("");
    });

    it("should be format simple", async () => {
      const formatter = createJSONLinesFormatter();
      expect(formatter.header()).toEqual("");
      expect(
        await formatter.rows({
          structs: [
            {
              foo: 123,
            },
          ],
          rowNumber: 0,
        })
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
      expect(await formatter.rows({ structs: [], rowNumber: 0 })).toEqual("");
      expect(formatter.footer()).toEqual(`]
`);
    });

    it("should be format simple", async () => {
      const formatter = createJSONFormatter();
      expect(formatter.header()).toEqual("[");
      expect(
        await formatter.rows({
          structs: [
            {
              foo: 123,
            },
          ],
          rowNumber: 0,
        })
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
      expect(await formatter.rows({ structs: [], rowNumber: 0 })).toEqual("");
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
        await formatter.rows({
          structs: [
            {
              a: "foo",
              b: "bar",
            },
            {
              a: "baz",
              b: "qux",
            },
          ],
          rowNumber: 0,
        })
      ).toEqual(`foo,bar
baz,qux
`);
      expect(formatter.footer()).toEqual(``);
    });
  });
});
