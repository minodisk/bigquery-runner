import { succeed } from "shared";
import { parseParameters } from "./parser";

describe("parser", () => {
  describe("parse", () => {
    it("should find no param with empty query", async () => {
      expect(parseParameters(``)).toStrictEqual(succeed(undefined));
    });

    it("should ignore ? in quoted string", async () => {
      expect(parseParameters(`"abc?"`)).toStrictEqual(succeed(undefined));
      expect(parseParameters(`"it's?"`)).toStrictEqual(succeed(undefined));
      expect(parseParameters(`'it\\'s?'`)).toStrictEqual(succeed(undefined));
      expect(parseParameters(`'Title: "Boy?"'`)).toStrictEqual(
        succeed(undefined)
      );
    });

    it("should ignore ? in triple-quoted string", async () => {
      expect(parseParameters(`"""abc?"""`)).toStrictEqual(succeed(undefined));
      expect(parseParameters(`'''it's?'''`)).toStrictEqual(succeed(undefined));
      expect(parseParameters(`'''Title: "Boy?"'''`)).toStrictEqual(
        succeed(undefined)
      );
      expect(
        parseParameters(`'''two
lines?'''`)
      ).toStrictEqual(succeed(undefined));
      expect(parseParameters(`'''why\\?'''`)).toStrictEqual(succeed(undefined));
    });

    it("should ignore ? in raw string", async () => {
      expect(parseParameters(`R"ab?c+"`)).toStrictEqual(succeed(undefined));
      expect(parseParameters(`r'''ab?c+'''`)).toStrictEqual(succeed(undefined));
      expect(parseParameters(`R"""ab?c+"""`)).toStrictEqual(succeed(undefined));
      expect(parseParameters(`r'f\\(abc,(.*?),def\\)'`)).toStrictEqual(
        succeed(undefined)
      );
    });

    it("should ignore sharp commented ?", async () => {
      expect(parseParameters(`#?`)).toStrictEqual(succeed(undefined));
    });

    it("should ignore dash commented ?", async () => {
      expect(parseParameters(`--?`)).toStrictEqual(succeed(undefined));
    });

    it("should ignore multiline commented ?", async () => {
      expect(parseParameters(`/*?*/`)).toStrictEqual(succeed(undefined));
    });

    it("should find positional param with question", async () => {
      expect(parseParameters(`?`)).toStrictEqual(
        succeed({
          type: "positional",
          keys: [
            {
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
          ],
        })
      );
    });

    it("should find positional param with line break and question", async () => {
      expect(
        parseParameters(`
?`)
      ).toStrictEqual(
        succeed({
          type: "positional",
          keys: [
            {
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
          ],
        })
      );
    });

    it("should find positional param with line break (\r\n) and question", async () => {
      expect(parseParameters(`\r\n?`)).toStrictEqual(
        succeed({
          type: "positional",
          keys: [
            {
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
          ],
        })
      );
    });

    it("should find positional params from complex query", () => {
      expect(
        parseParameters(`SELECT
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
      ).toStrictEqual(
        succeed({
          type: "positional",
          keys: [
            {
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
          ],
        })
      );
    });

    it("should find positional params from complex query with strings", () => {
      expect(
        parseParameters(`SELECT
    word,
    word_count
FROM
    \`bigquery-public-data.samples.shakespeare\`
WHERE
    word != "?"
    AND word != '?'
    AND word != '? it\\'s ?'
    AND word != "? it\\"s ?"
    AND word != """?"""
    AND word != """
?
"""
    AND word != """
\\""" ?
"""
    AND corpus = ? -- "romeoandjuliet" 
    AND word_count >= ? -- 250
ORDER BY
    word_count DESC
`)
      ).toStrictEqual(
        succeed({
          type: "positional",
          keys: [
            {
              range: {
                start: {
                  line: 17,
                  character: 17,
                },
                end: {
                  line: 17,
                  character: 18,
                },
              },
            },
            {
              range: {
                start: {
                  line: 18,
                  character: 22,
                },
                end: {
                  line: 18,
                  character: 23,
                },
              },
            },
          ],
        })
      );
    });

    it("should find positional params from complex query with comment", () => {
      expect(
        parseParameters(`SELECT
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
      ).toStrictEqual(
        succeed({
          type: "positional",
          keys: [
            {
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
          ],
        })
      );
    });

    it("should ignore sharp commented @", async () => {
      expect(parseParameters(`#@foo`)).toStrictEqual(succeed(undefined));
    });

    it("should ignore dash commented @", async () => {
      expect(parseParameters(`--@foo`)).toStrictEqual(succeed(undefined));
    });

    it("should ignore multiline commented @", async () => {
      expect(parseParameters(`/*\n@foo\n*/`)).toStrictEqual(succeed(undefined));
    });

    it("should find named param with @", async () => {
      expect(parseParameters(`@`)).toStrictEqual(
        succeed({
          type: "named",
          keys: [
            {
              token: "@",
              name: "",
              ranges: [
                {
                  start: {
                    line: 0,
                    character: 0,
                  },
                  end: {
                    line: 0,
                    character: 1,
                  },
                },
              ],
            },
          ],
        })
      );
    });

    it("should find named param with line break and @", async () => {
      expect(
        parseParameters(`
@`)
      ).toStrictEqual(
        succeed({
          type: "named",
          keys: [
            {
              token: "@",
              name: "",
              ranges: [
                {
                  start: {
                    line: 1,
                    character: 0,
                  },
                  end: {
                    line: 1,
                    character: 1,
                  },
                },
              ],
            },
          ],
        })
      );
    });

    it("should find named params from complex query", () => {
      expect(
        parseParameters(`SELECT
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
      ).toStrictEqual(
        succeed({
          type: "named",
          keys: [
            {
              token: "@corpus",
              name: "corpus",
              ranges: [
                {
                  start: {
                    line: 6,
                    character: 13,
                  },
                  end: {
                    line: 6,
                    character: 20,
                  },
                },
              ],
            },
            {
              token: "@min_word_count",
              name: "min_word_count",
              ranges: [
                {
                  start: {
                    line: 7,
                    character: 22,
                  },
                  end: {
                    line: 7,
                    character: 37,
                  },
                },
              ],
            },
          ],
        })
      );
    });

    it("should find same named params once", () => {
      expect(
        parseParameters(`SELECT
    word,
    word_count
FROM
    \`bigquery-public-data.samples.shakespeare\`
WHERE
    corpus = @corpus
    AND word_count >= @min_word_count
    AND word_count < @min_word_count + 100
ORDER BY
    word_count DESC
`)
      ).toStrictEqual(
        succeed({
          type: "named",
          keys: [
            {
              token: "@corpus",
              name: "corpus",
              ranges: [
                {
                  start: {
                    line: 6,
                    character: 13,
                  },
                  end: {
                    line: 6,
                    character: 20,
                  },
                },
              ],
            },
            {
              token: "@min_word_count",
              name: "min_word_count",
              ranges: [
                {
                  start: {
                    line: 7,
                    character: 22,
                  },
                  end: {
                    line: 7,
                    character: 37,
                  },
                },
                {
                  start: {
                    line: 8,
                    character: 21,
                  },
                  end: {
                    line: 8,
                    character: 36,
                  },
                },
              ],
            },
          ],
        })
      );
    });

    it("should find named params from complex query with strings", () => {
      expect(
        parseParameters(`SELECT
    word,
    word_count
FROM
    \`bigquery-public-data.samples.shakespeare\`
WHERE
    word != "@a"
    AND word != '@b'
    AND word != '@c it\\'s @c'
    AND word != "@d it\\"s @d"
    AND word != """@e"""
    AND word != """
@f
"""
    AND word != """
\\""" @f
"""
    AND corpus = @corpus -- "romeoandjuliet" 
    AND word_count >= @min_word_count -- 250
ORDER BY
    word_count DESC
`)
      ).toStrictEqual(
        succeed({
          type: "named",
          keys: [
            {
              token: "@corpus",
              name: "corpus",
              ranges: [
                {
                  start: {
                    line: 17,
                    character: 17,
                  },
                  end: {
                    line: 17,
                    character: 24,
                  },
                },
              ],
            },
            {
              token: "@min_word_count",
              name: "min_word_count",
              ranges: [
                {
                  start: {
                    line: 18,
                    character: 22,
                  },
                  end: {
                    line: 18,
                    character: 37,
                  },
                },
              ],
            },
          ],
        })
      );
    });

    it("should find named params from complex query with comments", () => {
      expect(
        parseParameters(`SELECT
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
      ).toStrictEqual(
        succeed({
          type: "named",
          keys: [
            {
              token: "@corpus",
              name: "corpus",
              ranges: [
                {
                  start: {
                    line: 10,
                    character: 13,
                  },
                  end: {
                    line: 10,
                    character: 20,
                  },
                },
              ],
            },
            {
              token: "@min_word_count",
              name: "min_word_count",
              ranges: [
                {
                  start: {
                    line: 13,
                    character: 40,
                  },
                  end: {
                    line: 13,
                    character: 55,
                  },
                },
              ],
            },
          ],
        })
      );
    });
  });
});
