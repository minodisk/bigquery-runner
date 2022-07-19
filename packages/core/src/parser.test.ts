import { parse } from "./parser";

describe("parser", () => {
  describe("parse", () => {
    it("should find no param with empty query", async () => {
      expect(parse(``)).toStrictEqual([]);
    });

    it("should find positional param with question", async () => {
      expect(parse(`?`)).toStrictEqual([
        {
          type: "positional",
          token: "?",
          index: 0,
          range: {
            start: {
              line: 0,
              character: 0,
            },
            end: {
              line: 0,
              character: 1,
            },
          },
        },
      ]);
    });

    it("should find positional param with line break and question", async () => {
      expect(
        parse(`
?`)
      ).toStrictEqual([
        {
          type: "positional",
          token: "?",
          index: 0,
          range: {
            start: {
              line: 1,
              character: 0,
            },
            end: {
              line: 1,
              character: 1,
            },
          },
        },
      ]);
    });

    it("should find positional param with line break (\r\n) and question", async () => {
      expect(parse(`\r\n?`)).toStrictEqual([
        {
          type: "positional",
          token: "?",
          index: 0,
          range: {
            start: {
              line: 1,
              character: 0,
            },
            end: {
              line: 1,
              character: 1,
            },
          },
        },
      ]);
    });

    it("should find positional params from complex query", () => {
      expect(
        parse(`SELECT
    word,
    word_count
FROM 
    \`bigquery-public-data.samples.shakespeare\`
WHERE
    corpus = ?
    AND word_count >= ?
ORDER BY
    word_count DESC
`)
      ).toStrictEqual([
        {
          type: "positional",
          token: "?",
          index: 0,
          range: {
            start: {
              line: 6,
              character: 13,
            },
            end: {
              line: 6,
              character: 14,
            },
          },
        },
        {
          type: "positional",
          token: "?",
          index: 1,
          range: {
            start: {
              line: 7,
              character: 22,
            },
            end: {
              line: 7,
              character: 23,
            },
          },
        },
      ]);
    });

    it("should find positional params from complex query with comment", () => {
      expect(
        parse(`SELECT
    corpus,
    word,
    # @foo,
    # @bar # -- @baz */ @qux,
    word_count
    -- @bar # @baz -- @foo #-- @qux
FROM 
    \`bigquery-public-data.samples.shakespeare\`
WHERE
    corpus = ?/* @foo -- @bar          -- "romeoandjuliet"
    @baz # /* @qux
    @foo
        @foo@bar    */AND word_count >= ? -- 250
ORDER BY
    word_count DESC
`)
      ).toStrictEqual([
        {
          type: "positional",
          token: "?",
          index: 0,
          range: {
            start: {
              line: 10,
              character: 13,
            },
            end: {
              line: 10,
              character: 14,
            },
          },
        },
        {
          type: "positional",
          token: "?",
          index: 1,
          range: {
            start: {
              line: 13,
              character: 40,
            },
            end: {
              line: 13,
              character: 41,
            },
          },
        },
      ]);
    });

    it("should ignore sharp commented @", async () => {
      expect(parse(`#@foo`)).toStrictEqual([]);
    });

    it("should ignore dash commented @", async () => {
      expect(parse(`--@foo`)).toStrictEqual([]);
    });

    it("should ignore multiline commented @", async () => {
      expect(parse(`/*\n@foo\n*/`)).toStrictEqual([]);
    });

    it("should find named param with @", async () => {
      expect(parse(`@`)).toStrictEqual([
        {
          type: "named",
          token: "@",
          name: "",
          range: {
            start: {
              line: 0,
              character: 0,
            },
            end: {
              line: 0,
              character: 1,
            },
          },
        },
      ]);
    });

    it("should find named param with line break and @", async () => {
      expect(
        parse(`
@`)
      ).toStrictEqual([
        {
          type: "named",
          token: "@",
          name: "",
          range: {
            start: {
              line: 1,
              character: 0,
            },
            end: {
              line: 1,
              character: 1,
            },
          },
        },
      ]);
    });

    it("should find named params from complex query", () => {
      expect(
        parse(`SELECT
    word,
    word_count
FROM
    \`bigquery-public-data.samples.shakespeare\`
WHERE
    corpus = @corpus
    AND word_count >= @min_word_count
ORDER BY
    word_count DESC
`)
      ).toStrictEqual([
        {
          type: "named",
          token: "@corpus",
          name: "corpus",
          range: {
            start: {
              line: 6,
              character: 13,
            },
            end: {
              line: 6,
              character: 20,
            },
          },
        },
        {
          type: "named",
          token: "@min_word_count",
          name: "min_word_count",
          range: {
            start: {
              line: 7,
              character: 22,
            },
            end: {
              line: 7,
              character: 37,
            },
          },
        },
      ]);
    });

    it("should find named params from complex query with comment", () => {
      expect(
        parse(`SELECT
    corpus,
    word,
    # @foo,
    # @bar # -- @baz */ @qux,
    word_count
    -- @bar # @baz -- @foo #-- @qux
FROM
    \`bigquery-public-data.samples.shakespeare\`
WHERE
    corpus = @corpus/* @foo -- @bar                   -- "romeoandjuliet" 
    @baz # /* @qux
    @foo
        @foo@bar    */AND word_count >= @min_word_count   -- 250
ORDER BY
    word_count DESC
`)
      ).toStrictEqual([
        {
          type: "named",
          token: "@corpus",
          name: "corpus",
          range: {
            start: {
              line: 10,
              character: 13,
            },
            end: {
              line: 10,
              character: 20,
            },
          },
        },
        {
          type: "named",
          token: "@min_word_count",
          name: "min_word_count",
          range: {
            start: {
              line: 13,
              character: 40,
            },
            end: {
              line: 13,
              character: 55,
            },
          },
        },
      ]);
    });
  });
});
