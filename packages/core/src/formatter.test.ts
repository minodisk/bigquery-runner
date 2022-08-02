import { PassThrough } from "stream";
import type { Field, StructuralRow } from "shared";
import {
  createCSVFormatter,
  createFlat,
  createJSONFormatter,
  createJSONLinesFormatter,
  createMarkdownFormatter,
  createTableFormatter,
} from ".";

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
const structs: Array<StructuralRow> = [
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

const createMockStream = () => {
  const writer = new PassThrough();
  let data = "";
  writer.on("data", (d) => (data += d.toString("utf-8")));
  const promise = new Promise((resolve) => {
    writer.on("end", () => resolve(data));
  });
  return {
    writer,
    async read() {
      return promise;
    },
  };
};

describe("formatter", () => {
  describe("createJSONLinesFormatter", () => {
    it("should be format empty", async () => {
      const stream = createMockStream();
      const formatter = createJSONLinesFormatter({
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({ structs: [], rowNumberStart: 0n });
      await formatter.foot();

      expect(await stream.read()).toEqual("");
    });

    it("should be format all types", async () => {
      const stream = createMockStream();
      const formatter = createJSONLinesFormatter({
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({
        structs,
        rowNumberStart: 0n,
      });
      await formatter.foot();

      expect(await stream.read()).toEqual(
        `{"bool":true,"int64":123,"float64":123.45,"numeric":123,"bignumeric":99999999,"string":"foo","bytes":"bar","date":"2016-01-02","datetime":"2016-01-02T15:04:05Z","time":"15:04:05Z","timestamp":"2016-01-02T15:04:05Z","interval":"01 01-02 15:04:05"}
{"bool":false,"int64":0,"float64":0,"numeric":0,"bignumeric":0,"string":"","bytes":"","date":"2016-01-02","datetime":"2016-01-02T15:04:05Z","time":"15:04:05Z","timestamp":"2016-01-02T15:04:05Z","interval":"0"}
{"bool":null,"int64":null,"float64":null,"numeric":null,"bignumeric":null,"string":null,"bytes":null,"date":null,"datetime":null,"time":null,"timestamp":null,"interval":null}
`
      );
    });
  });

  describe("createJSONFormatter", () => {
    it("should be format empty", async () => {
      const stream = createMockStream();
      const formatter = createJSONFormatter({
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({ structs: [], rowNumberStart: 0n });
      await formatter.foot();

      expect(await stream.read()).toEqual(`[]
`);
    });

    it("should be format all types", async () => {
      const stream = createMockStream();
      const formatter = createJSONFormatter({ writer: stream.writer });

      formatter.head();
      formatter.body({
        structs,
        rowNumberStart: 0n,
      });
      await formatter.foot();

      expect(await stream.read()).toEqual(
        `[{"bool":true,"int64":123,"float64":123.45,"numeric":123,"bignumeric":99999999,"string":"foo","bytes":"bar","date":"2016-01-02","datetime":"2016-01-02T15:04:05Z","time":"15:04:05Z","timestamp":"2016-01-02T15:04:05Z","interval":"01 01-02 15:04:05"},{"bool":false,"int64":0,"float64":0,"numeric":0,"bignumeric":0,"string":"","bytes":"","date":"2016-01-02","datetime":"2016-01-02T15:04:05Z","time":"15:04:05Z","timestamp":"2016-01-02T15:04:05Z","interval":"0"},{"bool":null,"int64":null,"float64":null,"numeric":null,"bignumeric":null,"string":null,"bytes":null,"date":null,"datetime":null,"time":null,"timestamp":null,"interval":null}]
`
      );
    });
  });

  describe("createCSVFormatter", () => {
    it("should be format empty", async () => {
      const flat = createFlat([]);
      const stream = createMockStream();
      const formatter = createCSVFormatter({
        flat,
        writer: stream.writer,
        options: {},
      });

      formatter.head();
      formatter.body({ structs: [], rowNumberStart: 0n });
      await formatter.foot();

      expect(await stream.read()).toEqual("");
    });

    it("should be format all types", async () => {
      const flat = createFlat(fields);
      const stream = createMockStream();
      const formatter = createCSVFormatter({
        flat,
        writer: stream.writer,
        options: {},
      });

      formatter.head();
      formatter.body({
        structs,
        rowNumberStart: 0n,
      });
      await formatter.foot();

      expect(await stream.read())
        .toEqual(`true,123,123.45,123,99999999,foo,bar,2016-01-02,2016-01-02T15:04:05Z,15:04:05Z,2016-01-02T15:04:05Z,01 01-02 15:04:05
false,0,0,0,0,,,2016-01-02,2016-01-02T15:04:05Z,15:04:05Z,2016-01-02T15:04:05Z,0
,,,,,,,,,,,
`);
    });

    it("should be output header with option", async () => {
      const flat = createFlat([
        { name: "a", type: "INTEGER", mode: "NULLABLE" },
        { name: "b", type: "STRING", mode: "NULLABLE" },
      ]);
      const stream = createMockStream();
      const formatter = createCSVFormatter({
        flat,
        writer: stream.writer,
        options: {
          header: true,
        },
      });

      formatter.head();
      formatter.body({
        structs: [
          {
            a: 1,
            b: "foo",
          },
          {
            a: 2,
            b: "bar",
          },
        ],
        rowNumberStart: 0n,
      });
      await formatter.foot();

      expect(await stream.read()).toEqual(`a,b
1,foo
2,bar
`);
    });

    it("should be output TSV with option", async () => {
      const flat = createFlat([
        { name: "a", type: "INTEGER", mode: "NULLABLE" },
        { name: "b", type: "STRING", mode: "NULLABLE" },
      ]);
      const stream = createMockStream();
      const formatter = createCSVFormatter({
        flat,
        writer: stream.writer,
        options: {
          header: true,
          delimiter: "\t",
        },
      });

      formatter.head();
      formatter.body({
        structs: [
          {
            a: 1,
            b: "foo",
          },
          {
            a: 2,
            b: "bar",
          },
        ],
        rowNumberStart: 0n,
      });
      await formatter.foot();

      expect(await stream.read()).toEqual(`a\tb
1\tfoo
2\tbar
`);
    });
  });

  describe("createMarkdownFormatter", () => {
    it("should be format empty", async () => {
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      const stream = createMockStream();
      const formatter = createMarkdownFormatter({
        flat,
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({ structs: [], rowNumberStart: 0n });
      await formatter.foot();

      expect(await stream.read()).toEqual(`|foo|
|---|
`);
    });

    it("should be format simple", async () => {
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      const stream = createMockStream();
      const formatter = createMarkdownFormatter({
        flat,
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({
        structs: [
          {
            foo: 123,
          },
        ],
        rowNumberStart: 0n,
      });
      await formatter.foot();

      expect(await stream.read()).toEqual(`|foo|
|---|
|123|
`);
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
      const stream = createMockStream();
      const formatter = createMarkdownFormatter({
        flat,
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({ ...complexStructs });
      await formatter.foot();

      expect(await stream.read()).toEqual(`|a|b.c|b.d|e|
|---|---|---|---|
|123|0.456|foo|true|
||0.789|bar||
|987|0.65|foo|false|
||0.43|bar||
||0.21|baz||
`);
    });

    it("should be format all types", async () => {
      const flat = createFlat(fields);
      const stream = createMockStream();
      const formatter = createMarkdownFormatter({
        flat,
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({
        structs,
        rowNumberStart: 0n,
      });
      await formatter.foot();

      expect(await stream.read())
        .toEqual(`|bool|int64|float64|numeric|bignumeric|string|bytes|date|datetime|time|timestamp|interval|
|---|---|---|---|---|---|---|---|---|---|---|---|
|true|123|123.45|123|99999999|foo|bar|2016-01-02|2016-01-02T15:04:05Z|15:04:05Z|2016-01-02T15:04:05Z|01 01-02 15:04:05|
|false|0|0|0|0|||2016-01-02|2016-01-02T15:04:05Z|15:04:05Z|2016-01-02T15:04:05Z|0|
|null|null|null|null|null|null|null|null|null|null|null|null|
`);
    });
  });

  describe("createTableFormatter", () => {
    it("should be format empty", async () => {
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      const stream = createMockStream();
      const formatter = createTableFormatter({
        flat,
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({ structs: [], rowNumberStart: 0n });
      await formatter.foot();

      expect(await stream.read()).toEqual("\n");
    });

    it("should be format simple", async () => {
      const flat = createFlat([
        { name: "foo", type: "INTEGER", mode: "NULLABLE" },
      ]);
      const stream = createMockStream();
      const formatter = createTableFormatter({
        flat,
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({
        structs: [
          {
            foo: 123,
          },
        ],
        rowNumberStart: 0n,
      });
      await formatter.foot();

      expect(await stream.read()).toEqual(
        `
foo
---
123
`.trimStart()
      );
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
      const stream = createMockStream();
      const formatter = createTableFormatter({
        flat,
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({ ...complexStructs });
      await formatter.foot();

      const actual = await stream.read();
      expect(actual).toEqual(
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
    });

    it("should be format all types", async () => {
      const flat = createFlat(fields);
      const stream = createMockStream();
      const formatter = createTableFormatter({
        flat,
        writer: stream.writer,
      });

      formatter.head();
      formatter.body({
        structs,
        rowNumberStart: 0n,
      });
      await formatter.foot();

      expect(await stream.read()).toEqual(
        `
bool   int64  float64  numeric  bignumeric  string  bytes  date        datetime              time       timestamp             interval         
-----  -----  -------  -------  ----------  ------  -----  ----------  --------------------  ---------  --------------------  -----------------
true   123    123.45   123      99999999    foo     bar    2016-01-02  2016-01-02T15:04:05Z  15:04:05Z  2016-01-02T15:04:05Z  01 01-02 15:04:05
false  0      0        0        0                          2016-01-02  2016-01-02T15:04:05Z  15:04:05Z  2016-01-02T15:04:05Z  0                
null   null   null     null     null        null    null   null        null                  null       null                  null
`.trimStart()
      );
    });
  });
});
