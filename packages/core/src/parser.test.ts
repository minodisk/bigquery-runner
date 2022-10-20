import { createParser } from "./parser";

describe("createParser", () => {
  it("should parse params", () => {
    const query = `
SELECT
    corpus,
    word,
    word_count
FROM
    \`bigquery-public-data.samples.shakespeare\`
WHERE
    corpus = @corpus -- "romeoandjuliet"
    AND word_count >= @min_word_count -- 250
ORDER BY
    word_count DESC
`;
    const { parse } = createParser();
    const tokens = parse(query);
    expect(tokens).toStrictEqual([
      {
        type: "RESERVED_SELECT",
        raw: "SELECT",
        text: "SELECT",
        start: 1,
        precedingWhitespace: "\n",
        line: 1,
        character: 0,
      },
      {
        type: "IDENTIFIER",
        raw: "corpus",
        text: "corpus",
        start: 12,
        precedingWhitespace: "\n    ",
        line: 2,
        character: 4,
      },
      {
        type: "COMMA",
        raw: ",",
        text: ",",
        start: 18,
        precedingWhitespace: undefined,
        line: 2,
        character: 10,
      },
      {
        type: "IDENTIFIER",
        raw: "word",
        text: "word",
        start: 24,
        precedingWhitespace: "\n    ",
        line: 3,
        character: 4,
      },
      {
        type: "COMMA",
        raw: ",",
        text: ",",
        start: 28,
        precedingWhitespace: undefined,
        line: 3,
        character: 8,
      },
      {
        type: "IDENTIFIER",
        raw: "word_count",
        text: "word_count",
        start: 34,
        precedingWhitespace: "\n    ",
        line: 4,
        character: 4,
      },
      {
        type: "RESERVED_CLAUSE",
        raw: "FROM",
        text: "FROM",
        start: 45,
        precedingWhitespace: "\n",
        line: 5,
        character: 0,
      },
      {
        type: "QUOTED_IDENTIFIER",
        raw: "`bigquery-public-data.samples.shakespeare`",
        text: "`bigquery-public-data.samples.shakespeare`",
        start: 54,
        precedingWhitespace: "\n    ",
        line: 6,
        character: 4,
      },
      {
        type: "RESERVED_CLAUSE",
        raw: "WHERE",
        text: "WHERE",
        start: 97,
        precedingWhitespace: "\n",
        line: 7,
        character: 0,
      },
      {
        type: "IDENTIFIER",
        raw: "corpus",
        text: "corpus",
        start: 107,
        precedingWhitespace: "\n    ",
        line: 8,
        character: 4,
      },
      {
        type: "OPERATOR",
        raw: "=",
        text: "=",
        start: 114,
        precedingWhitespace: " ",
        line: 8,
        character: 11,
      },
      {
        type: "NAMED_PARAMETER",
        raw: "@corpus",
        text: "@corpus",
        start: 116,
        key: "corpus",
        precedingWhitespace: " ",
        line: 8,
        character: 13,
      },
      {
        type: "LINE_COMMENT",
        raw: '-- "romeoandjuliet"',
        text: '-- "romeoandjuliet"',
        start: 124,
        precedingWhitespace: " ",
        line: 8,
        character: 21,
      },
      {
        type: "AND",
        raw: "AND",
        text: "AND",
        start: 148,
        precedingWhitespace: "\n    ",
        line: 9,
        character: 4,
      },
      {
        type: "IDENTIFIER",
        raw: "word_count",
        text: "word_count",
        start: 152,
        precedingWhitespace: " ",
        line: 9,
        character: 8,
      },
      {
        type: "OPERATOR",
        raw: ">=",
        text: ">=",
        start: 163,
        precedingWhitespace: " ",
        line: 9,
        character: 19,
      },
      {
        type: "NAMED_PARAMETER",
        raw: "@min_word_count",
        text: "@min_word_count",
        start: 166,
        key: "min_word_count",
        precedingWhitespace: " ",
        line: 9,
        character: 22,
      },
      {
        type: "LINE_COMMENT",
        raw: "-- 250",
        text: "-- 250",
        start: 182,
        precedingWhitespace: " ",
        line: 9,
        character: 38,
      },
      {
        type: "RESERVED_CLAUSE",
        raw: "ORDER BY",
        text: "ORDER BY",
        start: 189,
        precedingWhitespace: "\n",
        line: 10,
        character: 0,
      },
      {
        type: "IDENTIFIER",
        raw: "word_count",
        text: "word_count",
        start: 202,
        precedingWhitespace: "\n    ",
        line: 11,
        character: 4,
      },
      {
        type: "RESERVED_KEYWORD",
        raw: "DESC",
        text: "DESC",
        start: 213,
        precedingWhitespace: " ",
        line: 11,
        character: 15,
      },
    ]);
  });
});
