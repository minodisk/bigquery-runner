import { formatters } from "sql-formatter";
import type { Token as OrigToken } from "sql-formatter/lib/src/lexer/token";

export type Token = OrigToken & {
  line: number;
  character: number;
};

export const createParser = () => {
  const tokenizer = formatters.bigquery.prototype.tokenizer();

  const breaks = (precedingWhitespace: string) => {
    let newLines = 0;
    let charactersBeforeLastLine = 0;
    for (let i = 0; i < precedingWhitespace.length; i++) {
      const char = precedingWhitespace[i];
      if (char === "\n") {
        newLines += 1;
        charactersBeforeLastLine = i + 1;
      }
    }
    return { newLines, charactersBeforeLastLine };
  };

  return {
    parse(query: string): Array<Token> {
      const tokens = tokenizer.tokenize(query, {});
      let line = 0;
      let caret = 0;
      let lineStart = 0;
      return tokens.map((token) => {
        if (!token.precedingWhitespace) {
          const t = {
            ...token,
            line,
            character: token.start - lineStart,
          };
          caret += token.raw.length;
          return t;
        }
        const { newLines, charactersBeforeLastLine } = breaks(
          token.precedingWhitespace
        );
        line += newLines;
        if (newLines) {
          lineStart = caret + charactersBeforeLastLine;
        }
        const t = {
          ...token,
          line,
          character: token.start - lineStart,
        };
        caret += token.precedingWhitespace.length + token.raw.length;
        return t;
      });
    },
  };
};
