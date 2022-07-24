import { unwrap } from "shared";
import { createFlat } from "./flat";

describe("flat", () => {
  describe("structToRows", () => {
    it("Empty", () => {
      const flatResult = createFlat([]);
      if (!flatResult.success) {
        throw new Error("failed");
      }
      const flat = unwrap(flatResult);

      expect(flat.getNumberedRows({ structs: [], rowNumberStart: 0n })).toEqual(
        []
      );
    });

    it("Flat", () => {
      const flatResult = createFlat([
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
      if (!flatResult.success) {
        throw new Error("failed");
      }
      const flat = unwrap(flatResult);

      expect(
        flat.getNumberedRows({
          structs: [
            {
              a: "foo",
              b: 321,
            },
          ],
          rowNumberStart: 0n,
        })
      ).toEqual([
        {
          rowNumber: "0",
          rows: [
            [
              { id: "a", value: "foo" },
              { id: "b", value: 321 },
            ],
          ],
        },
      ]);
    });

    it("Struct", () => {
      const flatResult = createFlat([
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
      if (!flatResult.success) {
        throw new Error("failed");
      }
      const flat = unwrap(flatResult);

      expect(
        flat.getNumberedRows({
          structs: [
            {
              a: "foo",
              b: {
                c: true,
              },
              d: 123,
            },
          ],
          rowNumberStart: 0n,
        })
      ).toEqual([
        {
          rowNumber: "0",
          rows: [
            [
              { id: "a", value: "foo" },
              { id: "b.c", value: true },
              { id: "d", value: 123 },
            ],
          ],
        },
      ]);
    });

    it("Nullable Struct", () => {
      const flatResult = createFlat([
        {
          name: "a",
          type: "STRUCT",
          mode: "NULLABLE",
          fields: [
            {
              name: "b",
              type: "BOOLEAN",
              mode: "REQUIRED",
            },
            {
              name: "c",
              type: "STRUCT",
              mode: "NULLABLE",
              fields: [
                {
                  name: "d",
                  type: "INTEGER",
                  mode: "REQUIRED",
                },
              ],
            },
          ],
        },
      ]);
      if (!flatResult.success) {
        throw new Error("failed");
      }
      const flat = unwrap(flatResult);

      expect(
        flat.getNumberedRows({
          structs: [
            {
              a: {
                b: true,
                c: {
                  d: 1,
                },
              },
            },
            {
              a: null,
            },
            {
              a: {
                b: true,
                c: null,
              },
            },
          ],
          rowNumberStart: 0n,
        })
      ).toEqual([
        {
          rowNumber: "0",
          rows: [
            [
              { id: "a.b", value: true },
              { id: "a.c.d", value: 1 },
            ],
          ],
        },
        {
          rowNumber: "1",
          rows: [
            [
              { id: "a.b", value: null },
              { id: "a.c.d", value: null },
            ],
          ],
        },
        {
          rowNumber: "2",
          rows: [
            [
              { id: "a.b", value: true },
              { id: "a.c.d", value: null },
            ],
          ],
        },
      ]);
    });

    it("Array<Nullable Struct>", () => {
      const flatResult = createFlat([
        {
          name: "a",
          type: "STRUCT",
          mode: "REPEATED",
          fields: [
            {
              name: "b",
              type: "BOOLEAN",
              mode: "REQUIRED",
            },
            {
              name: "c",
              type: "STRUCT",
              mode: "NULLABLE",
              fields: [
                {
                  name: "d",
                  type: "STRUCT",
                  mode: "NULLABLE",
                  fields: [
                    {
                      name: "e",
                      type: "INTEGER",
                      mode: "REQUIRED",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]);
      if (!flatResult.success) {
        throw new Error("failed");
      }
      const flat = unwrap(flatResult);

      expect(
        flat.getNumberedRows({
          structs: [
            {
              a: [
                {
                  b: true,
                  c: {
                    d: {
                      e: 1,
                    },
                  },
                },
                {
                  b: true,
                  c: null,
                },
                {
                  b: true,
                  c: {
                    d: null,
                  },
                },
              ],
            },
          ],
          rowNumberStart: 0n,
        })
      ).toEqual([
        {
          rowNumber: "0",
          rows: [
            [
              { id: "a.b", value: true },
              { id: "a.c.d.e", value: 1 },
            ],
            [
              { id: "a.b", value: true },
              { id: "a.c.d.e", value: null },
            ],
            [
              { id: "a.b", value: true },
              { id: "a.c.d.e", value: null },
            ],
          ],
        },
      ]);
    });

    it("Empty Array<Value>", () => {
      const flatResult = createFlat([
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
      if (!flatResult.success) {
        throw new Error("failed");
      }
      const flat = unwrap(flatResult);

      expect(
        flat.getNumberedRows({
          structs: [
            {
              a: "foo",
              b: [],
              c: 0.123,
            },
          ],
          rowNumberStart: 0n,
        })
      ).toEqual([
        {
          rowNumber: "0",
          rows: [
            [
              { id: "a", value: "foo" },
              { id: "b", value: undefined },
              { id: "c", value: 0.123 },
            ],
          ],
        },
      ]);
    });

    it("Array<Value>", () => {
      const flatResult = createFlat([
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
      if (!flatResult.success) {
        throw new Error("failed");
      }
      const flat = unwrap(flatResult);

      expect(
        flat.getNumberedRows({
          structs: [
            {
              a: "foo",
              b: [123, 456, 789],
              c: true,
              d: [0.123, 0.456],
            },
          ],
          rowNumberStart: 0n,
        })
      ).toEqual([
        {
          rowNumber: "0",
          rows: [
            [
              { id: "a", value: "foo" },
              { id: "b", value: 123 },
              { id: "c", value: true },
              { id: "d", value: 0.123 },
            ],
            [
              { id: "a", value: undefined },
              { id: "b", value: 456 },
              { id: "c", value: undefined },
              { id: "d", value: 0.456 },
            ],
            [
              { id: "a", value: undefined },
              { id: "b", value: 789 },
              { id: "c", value: undefined },
              { id: "d", value: undefined },
            ],
          ],
        },
      ]);
    });

    it("Empty Array<Struct>", () => {
      const flatResult = createFlat([
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
      if (!flatResult.success) {
        throw new Error("failed");
      }
      const flat = unwrap(flatResult);

      expect(
        flat.getNumberedRows({
          structs: [
            {
              a: "foo",
              b: [],
              f: 0.123,
            },
          ],
          rowNumberStart: 0n,
        })
      ).toEqual([
        {
          rowNumber: "0",
          rows: [
            [
              { id: "a", value: "foo" },
              { id: "b.c", value: undefined },
              { id: "b.d", value: undefined },
              { id: "b.e", value: undefined },
              { id: "f", value: 0.123 },
            ],
          ],
        },
      ]);
    });

    it("Array<Struct>", () => {
      const flatResult = createFlat([
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
      if (!flatResult.success) {
        throw new Error("failed");
      }
      const flat = unwrap(flatResult);

      expect(
        flat.getNumberedRows({
          structs: [
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
          ],
          rowNumberStart: 0n,
        })
      ).toEqual([
        {
          rowNumber: "0",
          rows: [
            [
              { id: "a", value: "foo" },
              { id: "b.c", value: true },
              { id: "b.d", value: 0.123 },
            ],
            [
              { id: "a", value: undefined },
              { id: "b.c", value: false },
              { id: "b.d", value: 0.456 },
            ],
            [
              { id: "a", value: undefined },
              { id: "b.c", value: false },
              { id: "b.d", value: 0.789 },
            ],
          ],
        },
      ]);
    });

    it("Array<Struct<Array<Struct>>>", () => {
      const flatResult = createFlat([
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
      if (!flatResult.success) {
        throw new Error("failed");
      }
      const flat = unwrap(flatResult);

      expect(
        flat.getNumberedRows({
          structs: [
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
          ],
          rowNumberStart: 0n,
        })
      ).toEqual([
        {
          rowNumber: "0",
          rows: [
            [{ id: "a.b.c", value: "foo" }],
            [{ id: "a.b.c", value: "bar" }],
            [{ id: "a.b.c", value: "baz" }],
            [{ id: "a.b.c", value: "qux" }],
            [{ id: "a.b.c", value: "quux" }],
            [{ id: "a.b.c", value: "corge" }],
          ],
        },
      ]);
    });
  });

  // describe("primitiveToCell", () => {
  //   it("should return primitive values as they are", () => {
  //     const flatResult = createFlat([
  //       {
  //         name: "BIGNUMERIC",
  //         type: "BIGNUMERIC",
  //       },
  //       {
  //         name: "BOOL",
  //         type: "BOOL",
  //       },
  //       {
  //         name: "BOOLEAN",
  //         type: "BOOLEAN",
  //       },
  //       {
  //         name: "BYTES",
  //         type: "BYTES",
  //       },
  //       {
  //         name: "DATE",
  //         type: "DATE",
  //       },
  //       {
  //         name: "DATETIME",
  //         type: "DATETIME",
  //       },
  //       {
  //         name: "FLOAT",
  //         type: "FLOAT",
  //       },
  //       {
  //         name: "FLOAT64",
  //         type: "FLOAT64",
  //       },
  //       {
  //         name: "FLOAT",
  //         type: "FLOAT",
  //       },
  //       {
  //         name: "INT64",
  //         type: "INT64",
  //       },
  //       {
  //         name: "INTEGER",
  //         type: "INTEGER",
  //       },
  //       {
  //         name: "INTERVAL",
  //         type: "INTERVAL",
  //       },
  //       {
  //         name: "NUMERIC",
  //         type: "NUMERIC",
  //       },
  //       {
  //         name: "RECORD",
  //         type: "RECORD",
  //       },
  //       {
  //         name: "STRING",
  //         type: "STRING",
  //       },
  //       {
  //         name: "STRUCT",
  //         type: "STRUCT",
  //       },
  //       {
  //         name: "TIME",
  //         type: "TIME",
  //       },
  //       {
  //         name: "TIMESTAMP",
  //         type: "TIMESTAMP",
  //       },
  //     ]);
  //     expect(
  //       flat.toRows({
  //         structs: [
  //           {
  //             a: "foo",
  //             b: 321,
  //           },
  //         ],
  //         rowNumber: 0,
  //       })
  //     ).toEqual([
  //       {
  //         rowNumber: 0,
  //         rows: [
  //           [
  //             { id: "a", value: "foo" },
  //             { id: "b", value: 321 },
  //           ],
  //         ],
  //       },
  //     ]);
  //   });
  // });
});
