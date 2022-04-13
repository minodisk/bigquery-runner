import {
  createCSVFormatter,
  createFlat,
  createJSONFormatter,
  createJSONLinesFormatter,
  createMarkdownFormatter,
  createTableFormatter,
} from ".";
import { Field, Struct } from "./types";

const fields: Array<Field> = [
  { name: "bool", type: "BOOL", mode: "NULLABLE" },
  { name: "int64", type: "INT64", mode: "NULLABLE" },
  { name: "float64", type: "FLOAT64", mode: "NULLABLE" },
  { name: "numeric", type: "NUMERIC", mode: "NULLABLE" },
  { name: "bignumeric", type: "BIGNUMERIC", mode: "NULLABLE" },
  { name: "string", type: "STRING", mode: "NULLABLE" },
  { name: "bytes", type: "BYTES", mode: "NULLABLE" },
  { name: "date", type: "DATE", mode: "NULLABLE" },
  { name: "datetime", type: "DATETIME", mode: "NULLABLE" },
  { name: "time", type: "TIME", mode: "NULLABLE" },
  { name: "timestamp", type: "TIMESTAMP", mode: "NULLABLE" },
  { name: "interval", type: "INTERVAL", mode: "NULLABLE" },
];
const structs: Array<Struct> = [
  {
    bool: true,
    int64: 123,
    float64: 123.45,
    numeric: 123,
    bignumeric: 99999999,
    string: "foo",
    bytes: "bar",
    date: "2016-01-02",
    datetime: "2016-01-02T15:04:05Z",
    time: "15:04:05Z",
    timestamp: "2016-01-02T15:04:05Z",
    interval: "01 01-02 15:04:05",
  },
  {
    bool: false,
    int64: 0,
    float64: 0,
    numeric: 0,
    bignumeric: 0,
    string: "",
    bytes: "",
    date: "2016-01-02",
    datetime: "2016-01-02T15:04:05Z",
    time: "15:04:05Z",
    timestamp: "2016-01-02T15:04:05Z",
    interval: "0",
  },
  {
    bool: null,
    int64: null,
    float64: null,
    numeric: null,
    bignumeric: null,
    string: null,
    bytes: null,
    date: null,
    datetime: null,
    time: null,
    timestamp: null,
    interval: null,
  },
];

// const complexFields = [
//   { name: "a", type: "INTEGER", mode: "NULLABLE" },
//   {
//     name: "b",
//     type: "STRUCT",
//     mode: "REPEATED",
//     fields: [
//       { name: "c", type: "FLOAT", mode: "NULLABLE" },
//       { name: "d", type: "STRING", mode: "NULLABLE" },
//     ],
//   },
//   { name: "e", type: "BOOLEAN", mode: "NULLABLE" },
// ];
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
  rowNumberStart: 0n,
};

describe("formatter", () => {
  describe("createTableFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createTableFormatter();
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      expect(formatter.header({ flat })).toEqual("");
      expect(
        await formatter.rows({ structs: [], rowNumberStart: 0n, flat })
      ).toEqual("\n");
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
          rowNumberStart: 0n,
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

    it("should be format all types", async () => {
      const formatter = createTableFormatter();
      const flat = createFlat(fields);
      expect(formatter.header({ flat })).toEqual(``);
      expect(
        await formatter.rows({
          structs,
          rowNumberStart: 0n,
          flat,
        })
      ).toEqual(
        `
bool   int64  float64  numeric  bignumeric  string  bytes  date        datetime              time       timestamp             interval         
-----  -----  -------  -------  ----------  ------  -----  ----------  --------------------  ---------  --------------------  -----------------
true   123    123.45   123      99999999    foo     bar    2016-01-02  2016-01-02T15:04:05Z  15:04:05Z  2016-01-02T15:04:05Z  01 01-02 15:04:05
false  0      0        0        0                          2016-01-02  2016-01-02T15:04:05Z  15:04:05Z  2016-01-02T15:04:05Z  0                
null   null   null     null     null        null    null   null        null                  null       null                  null
`.trimStart()
      );
      expect(formatter.footer()).toEqual(``);
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
      expect(
        await formatter.rows({ structs: [], rowNumberStart: 0n, flat })
      ).toEqual("\n");
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
          rowNumberStart: 0n,
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

    it("should be format all types", async () => {
      const formatter = createMarkdownFormatter();
      const flat = createFlat(fields);
      expect(formatter.header({ flat }))
        .toEqual(`|bool|int64|float64|numeric|bignumeric|string|bytes|date|datetime|time|timestamp|interval|
|---|---|---|---|---|---|---|---|---|---|---|---|
`);
      expect(
        await formatter.rows({
          structs,
          rowNumberStart: 0n,
          flat,
        })
      ).toEqual(
        `|true|123|123.45|123|99999999|foo|bar|2016-01-02|2016-01-02T15:04:05Z|15:04:05Z|2016-01-02T15:04:05Z|01 01-02 15:04:05|
|false|0|0|0|0|||2016-01-02|2016-01-02T15:04:05Z|15:04:05Z|2016-01-02T15:04:05Z|0|
|null|null|null|null|null|null|null|null|null|null|null|null|
`
      );
      expect(formatter.footer()).toEqual(``);
    });
  });

  describe("createJSONLinesFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createJSONLinesFormatter();
      const flat = createFlat([]);
      expect(formatter.header({ flat })).toEqual("");
      expect(
        await formatter.rows({ structs: [], rowNumberStart: 0n, flat })
      ).toEqual("\n");
      expect(formatter.footer()).toEqual("");
    });

    it("should be format all types", async () => {
      const formatter = createJSONLinesFormatter();
      const flat = createFlat([]);
      expect(formatter.header({ flat })).toEqual("");
      expect(
        await formatter.rows({
          structs,
          rowNumberStart: 0n,
          flat,
        })
      ).toEqual(
        `{"bool":true,"int64":123,"float64":123.45,"numeric":123,"bignumeric":99999999,"string":"foo","bytes":"bar","date":"2016-01-02","datetime":"2016-01-02T15:04:05Z","time":"15:04:05Z","timestamp":"2016-01-02T15:04:05Z","interval":"01 01-02 15:04:05"}
{"bool":false,"int64":0,"float64":0,"numeric":0,"bignumeric":0,"string":"","bytes":"","date":"2016-01-02","datetime":"2016-01-02T15:04:05Z","time":"15:04:05Z","timestamp":"2016-01-02T15:04:05Z","interval":"0"}
{"bool":null,"int64":null,"float64":null,"numeric":null,"bignumeric":null,"string":null,"bytes":null,"date":null,"datetime":null,"time":null,"timestamp":null,"interval":null}
`
      );
      expect(formatter.footer()).toEqual(``);
    });
  });

  describe("createJSONFormatter", () => {
    it("should be format empty", async () => {
      const formatter = createJSONFormatter();
      const flat = createFlat([]);
      expect(formatter.header({ flat })).toEqual("[");
      expect(
        await formatter.rows({ structs: [], rowNumberStart: 0n, flat })
      ).toEqual("");
      expect(formatter.footer()).toEqual(`]
`);
    });

    it("should be format all types", async () => {
      const formatter = createJSONFormatter();
      const flat = createFlat([]);
      expect(formatter.header({ flat })).toEqual("[");
      expect(
        await formatter.rows({
          structs,
          rowNumberStart: 0n,
          flat,
        })
      ).toEqual(
        `{"bool":true,"int64":123,"float64":123.45,"numeric":123,"bignumeric":99999999,"string":"foo","bytes":"bar","date":"2016-01-02","datetime":"2016-01-02T15:04:05Z","time":"15:04:05Z","timestamp":"2016-01-02T15:04:05Z","interval":"01 01-02 15:04:05"},{"bool":false,"int64":0,"float64":0,"numeric":0,"bignumeric":0,"string":"","bytes":"","date":"2016-01-02","datetime":"2016-01-02T15:04:05Z","time":"15:04:05Z","timestamp":"2016-01-02T15:04:05Z","interval":"0"},{"bool":null,"int64":null,"float64":null,"numeric":null,"bignumeric":null,"string":null,"bytes":null,"date":null,"datetime":null,"time":null,"timestamp":null,"interval":null}`
      );
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
      expect(
        await formatter.rows({ structs: [], rowNumberStart: 0n, flat })
      ).toEqual("");
      expect(formatter.footer()).toEqual(``);
    });

    it("should be format all types", async () => {
      const formatter = createCSVFormatter({
        options: {},
      });
      const flat = createFlat(fields);
      expect(formatter.header({ flat })).toEqual("");
      expect(
        await formatter.rows({
          structs,
          rowNumberStart: 0n,
          flat,
        })
      )
        .toEqual(`true,123,123.45,123,99999999,foo,bar,2016-01-02,2016-01-02T15:04:05Z,15:04:05Z,2016-01-02T15:04:05Z,01 01-02 15:04:05
false,0,0,0,0,,,2016-01-02,2016-01-02T15:04:05Z,15:04:05Z,2016-01-02T15:04:05Z,0
,,,,,,,,,,,
`);
      expect(formatter.footer()).toEqual(``);
    });
  });
});
