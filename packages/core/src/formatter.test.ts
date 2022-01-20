import {
  createCSVFormatter,
  createFlat,
  createJSONFormatter,
  createJSONLinesFormatter,
  createMarkdownFormatter,
  createTableFormatter,
} from ".";

const complexFields = [
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
];
const complexStructs = {
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
};

describe("formatter", () => {
  describe("createTableFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createTableFormatter();
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      expect(formatter.header({ flat })).toEqual("");
      expect(await formatter.rows({ structs: [], rowNumber: 0, flat })).toEqual(
        "\n"
      );
      expect(formatter.footer()).toEqual("");
    });

    it("should be format simple", async () => {
      const formatter = createTableFormatter();
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      expect(formatter.header({ flat })).toEqual("");
      expect(
        await formatter.rows({
          structs: [
            {
              foo: 123,
            },
          ],
          rowNumber: 0,
          flat,
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

    it("should be format complex", async () => {
      const formatter = createTableFormatter();
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
      expect(formatter.header({ flat })).toEqual("");
      expect(await formatter.rows({ ...complexStructs, flat })).toEqual(
        `
a    b.c    b.d  e    
---  -----  ---  -----
123  0.456  foo  true 
     0.789  bar       
987  0.65   foo  false
     0.43   bar       
     0.21   baz
`.trimStart()
      );
      expect(formatter.footer()).toEqual("");
    });
  });

  describe("createMarkdownFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createMarkdownFormatter();
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      expect(formatter.header({ flat })).toEqual(
        `
|foo|
|---|
`.trimStart()
      );
      expect(await formatter.rows({ structs: [], rowNumber: 0, flat })).toEqual(
        "\n"
      );
      expect(formatter.footer()).toEqual("");
    });

    it("should be format simple", async () => {
      const formatter = createMarkdownFormatter();
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      expect(formatter.header({ flat })).toEqual(
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
          flat,
        })
      ).toEqual(
        `
|123|
`.trimStart()
      );
      expect(formatter.footer()).toEqual("");
    });

    it("should be format complex", async () => {
      const formatter = createMarkdownFormatter();
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
      expect(formatter.header({ flat })).toEqual(
        `
|a|b.c|b.d|e|
|---|---|---|---|
`.trimStart()
      );
      expect(await formatter.rows({ ...complexStructs, flat })).toEqual(
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
      const flat = createFlat([]);
      expect(formatter.header({ flat })).toEqual("");
      expect(await formatter.rows({ structs: [], rowNumber: 0, flat })).toEqual(
        "\n"
      );
      expect(formatter.footer()).toEqual("");
    });

    it("should be format simple", async () => {
      const formatter = createJSONLinesFormatter();
      const flat = createFlat([]);
      expect(formatter.header({ flat })).toEqual("");
      expect(
        await formatter.rows({
          structs: [
            {
              foo: 123,
            },
          ],
          rowNumber: 0,
          flat,
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
      const flat = createFlat([]);
      expect(formatter.header({ flat })).toEqual("[");
      expect(await formatter.rows({ structs: [], rowNumber: 0, flat })).toEqual(
        ""
      );
      expect(formatter.footer()).toEqual(`]
`);
    });

    it("should be format simple", async () => {
      const formatter = createJSONFormatter();
      const flat = createFlat([]);
      expect(formatter.header({ flat })).toEqual("[");
      expect(
        await formatter.rows({
          structs: [
            {
              foo: 123,
            },
          ],
          rowNumber: 0,
          flat,
        })
      ).toEqual(`{"foo":123}`);
      expect(formatter.footer()).toEqual(`]
`);
    });
  });

  describe("createCSVFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createCSVFormatter({
        options: {},
      });
      const flat = createFlat([]);
      expect(formatter.header({ flat })).toEqual("");
      expect(await formatter.rows({ structs: [], rowNumber: 0, flat })).toEqual(
        ""
      );
      expect(formatter.footer()).toEqual(``);
    });

    it("should be format simple", async () => {
      const formatter = createCSVFormatter({
        options: {},
      });
      const flat = createFlat([
        { name: "a", type: "STRING", mode: "NULLABLE" },
        { name: "b", type: "STRING", mode: "NULLABLE" },
      ]);
      expect(formatter.header({ flat })).toEqual("");
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
          flat,
        })
      ).toEqual(`foo,bar
baz,qux
`);
      expect(formatter.footer()).toEqual(``);
    });
  });
});
