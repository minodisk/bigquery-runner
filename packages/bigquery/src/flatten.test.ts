import { structToRows } from "./flatten";

describe("structToRows", () => {
  it("Empty", () => {
    expect(
      structToRows({
        fields: [],
        struct: {},
      })
    ).toEqual([]);
  });

  it("Flat", () => {
    expect(
      structToRows({
        fields: [
          {
            name: "a",
            type: "STRING",
            mode: "REQUIRED",
          },
          {
            name: "b",
            type: "INTEGER",
            mode: "REQUIRED",
          },
        ],
        struct: {
          a: "foo",
          b: 321,
        },
      })
    ).toEqual([["foo", 321]]);
  });

  it("Struct", () => {
    expect(
      structToRows({
        fields: [
          {
            name: "a",
            type: "STRING",
            mode: "REQUIRED",
          },
          {
            name: "b",
            type: "STRUCT",
            mode: "REQUIRED",
            fields: [
              {
                name: "c",
                type: "BOOLEAN",
                mode: "REQUIRED",
              },
            ],
          },
          {
            name: "d",
            type: "INTEGER",
            mode: "REQUIRED",
          },
        ],
        struct: {
          a: "foo",
          b: {
            c: true,
          },
          d: 123,
        },
      })
    ).toEqual([["foo", true, 123]]);
  });

  it("Array<Value>", () => {
    expect(
      structToRows({
        fields: [
          {
            name: "a",
            type: "STRING",
            mode: "REQUIRED",
          },
          {
            name: "b",
            type: "INTEGER",
            mode: "REPEATED",
          },
          {
            name: "c",
            type: "BOOLEAN",
            mode: "REQUIRED",
          },
          {
            name: "d",
            type: "FLOAT",
            mode: "REPEATED",
          },
        ],
        struct: {
          a: "foo",
          b: [123, 456, 789],
          c: true,
          d: [0.123, 0.456],
        },
      })
    ).toEqual([
      ["foo", 123, true, 0.123],
      [undefined, 456, undefined, 0.456],
      [undefined, 789],
    ]);
  });

  it("Array<Struct>", () => {
    expect(
      structToRows({
        fields: [
          {
            name: "a",
            type: "STRING",
            mode: "REQUIRED",
          },
          {
            name: "b",
            type: "STRUCT",
            mode: "REPEATED",
            fields: [
              {
                name: "c",
                type: "BOOLEAN",
                mode: "REQUIRED",
              },
              {
                name: "d",
                type: "FLOAT",
                mode: "REQUIRED",
              },
            ],
          },
        ],
        struct: {
          a: "foo",
          b: [
            {
              c: true,
              d: 0.123,
            },
            {
              c: false,
              d: 0.456,
            },
            {
              c: false,
              d: 0.789,
            },
          ],
        },
      })
    ).toEqual([
      ["foo", true, 0.123],
      [undefined, false, 0.456],
      [undefined, false, 0.789],
    ]);
  });

  it("Array<Struct<Array<Struct>>>", () => {
    expect(
      structToRows({
        fields: [
          {
            name: "a",
            type: "STRUCT",
            mode: "REPEATED",
            fields: [
              {
                name: "b",
                type: "STRUCT",
                mode: "REPEATED",
                fields: [
                  {
                    name: "c",
                    type: "STRING",
                    mode: "REQUIRED",
                  },
                ],
              },
            ],
          },
        ],
        struct: {
          a: [
            {
              b: [
                {
                  c: "foo",
                },
                {
                  c: "bar",
                },
                {
                  c: "baz",
                },
              ],
            },
            {
              b: [
                {
                  c: "qux",
                },
                {
                  c: "quux",
                },
              ],
            },
            {
              b: [
                {
                  c: "corge",
                },
              ],
            },
          ],
        },
      })
    ).toEqual([["foo"], ["bar"], ["baz"], ["qux"], ["quux"], ["corge"]]);
  });
});
