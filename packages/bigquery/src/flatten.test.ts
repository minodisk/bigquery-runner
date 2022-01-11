import { createFlatten } from "./flatten";

describe("structToRows", () => {
  it("Empty", () => {
    const flatten = createFlatten([]);
    expect(flatten.toRows([])).toEqual([]);
  });

  it("Flat", () => {
    const flatten = createFlatten([
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
    ]);
    expect(
      flatten.toRows([
        {
          a: "foo",
          b: 321,
        },
      ])
    ).toEqual([
      [
        { id: "a", value: "foo" },
        { id: "b", value: 321 },
      ],
    ]);
  });

  it("Struct", () => {
    const flatten = createFlatten([
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
    ]);
    expect(
      flatten.toRows([
        {
          a: "foo",
          b: {
            c: true,
          },
          d: 123,
        },
      ])
    ).toEqual([
      [
        { id: "a", value: "foo" },
        { id: "b.c", value: true },
        { id: "d", value: 123 },
      ],
    ]);
  });

  it("Empty Array<Value>", () => {
    const flatten = createFlatten([
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
        type: "FLOAT",
        mode: "REQUIRED",
      },
    ]);
    expect(
      flatten.toRows([
        {
          a: "foo",
          b: [],
          c: 0.123,
        },
      ])
    ).toEqual([
      [{ id: "a", value: "foo" }, undefined, { id: "c", value: 0.123 }],
    ]);
  });

  it("Array<Value>", () => {
    const flatten = createFlatten([
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
    ]);
    expect(
      flatten.toRows([
        {
          a: "foo",
          b: [123, 456, 789],
          c: true,
          d: [0.123, 0.456],
        },
      ])
    ).toEqual([
      [
        { id: "a", value: "foo" },
        { id: "b", value: 123 },
        { id: "c", value: true },
        { id: "d", value: 0.123 },
      ],
      [
        undefined,
        { id: "b", value: 456 },
        undefined,
        { id: "d", value: 0.456 },
      ],
      [undefined, { id: "b", value: 789 }],
    ]);
  });

  it("Empty Array<Struct>", () => {
    const flatten = createFlatten([
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
          {
            name: "e",
            type: "STRING",
            mode: "REQUIRED",
          },
        ],
      },
      {
        name: "f",
        type: "FLOAT",
        mode: "REQUIRED",
      },
    ]);
    expect(
      flatten.toRows([
        {
          a: "foo",
          b: [],
          f: 0.123,
        },
      ])
    ).toEqual([
      [
        { id: "a", value: "foo" },
        undefined,
        undefined,
        undefined,
        { id: "f", value: 0.123 },
      ],
    ]);
  });

  it("Array<Struct>", () => {
    const flatten = createFlatten([
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
    ]);
    expect(
      flatten.toRows([
        {
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
      ])
    ).toEqual([
      [
        { id: "a", value: "foo" },
        { id: "b.c", value: true },
        { id: "b.d", value: 0.123 },
      ],
      [undefined, { id: "b.c", value: false }, { id: "b.d", value: 0.456 }],
      [undefined, { id: "b.c", value: false }, { id: "b.d", value: 0.789 }],
    ]);
  });

  it("Array<Struct<Array<Struct>>>", () => {
    const flatten = createFlatten([
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
    ]);
    expect(
      flatten.toRows([
        {
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
      ])
    ).toEqual([
      [{ id: "a.b.c", value: "foo" }],
      [{ id: "a.b.c", value: "bar" }],
      [{ id: "a.b.c", value: "baz" }],
      [{ id: "a.b.c", value: "qux" }],
      [{ id: "a.b.c", value: "quux" }],
      [{ id: "a.b.c", value: "corge" }],
    ]);
  });
});
