export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };

export type NamedParameter = {
  type: "named";
  token: `@${string}`;
  name: string;
  ranges: ReadonlyArray<Range>;
};
export type PositionalParameter = {
  type: "positional";
  token: "?";
  index: number;
  range: Range;
};

export type Parameters = {
  named: ReadonlyArray<NamedParameter>;
  positional: ReadonlyArray<PositionalParameter>;
};

export const parameters = (query: string): Parameters => {
  const named = new Map<string, NamedParameter>();
  const positional: Array<PositionalParameter> = [];

  let pointer = 0;
  let line = 0;
  let character = 0;
  let index = 0;
  let comment: "single" | "multi" | null = null;
  while (pointer < query.length) {
    const curr = query[pointer];
    if (!curr) {
      break;
    }
    const next = query[pointer + 1];

    // Line break
    if (curr === "\n") {
      pointer += 1;
      line += 1;
      character = 0;
      // End single-line comment
      if (comment === "single") {
        comment = null;
      }
      continue;
    }
    if (curr === "\r" && next === "\n") {
      pointer += 2;
      line += 1;
      character = 0;
      // End single-line comment
      if (comment === "single") {
        comment = null;
      }
      continue;
    }

    // End asterisk multi-line comment
    if (curr === "*" && next === "/" && comment === "multi") {
      pointer += 2;
      character += 2;
      comment = null;
      continue;
    }

    // During commenting, stop parsing and just move the pointer forward.
    if (comment) {
      pointer += 1;
      character += 1;
      continue;
    }

    // Start sharp single-line comment
    if (curr === "#") {
      pointer += 1;
      character += 1;
      comment = "single";
      continue;
    }
    // Start dash single-line comment
    if (curr === "-" && next === "-") {
      pointer += 2;
      character += 2;
      comment = "single";
      continue;
    }
    // Start asterisk multi-line comment
    if (curr === "/" && next === "*") {
      pointer += 2;
      character += 2;
      comment = "multi";
      continue;
    }

    // Positional parameter
    if (curr === "?" && !isTokenChar(next)) {
      positional.push({
        type: "positional",
        token: "?",
        index,
        range: {
          start: { line, character },
          end: { line, character: character + 1 },
        },
      });

      pointer += 1;
      character += 1;
      index += 1;
      continue;
    }

    // Named parameter
    if (curr === "@") {
      const start = { line, character };

      pointer += 1;
      character += 1;

      let name = "";
      for (let p = pointer; p < query.length; p += 1) {
        const c = query[p];
        if (!c || !isTokenChar(c)) {
          break;
        }

        name += c;

        pointer += 1;
        character += 1;
      }

      const n = named.get(name);
      const range = {
        start,
        end: { line, character },
      };
      if (!n) {
        named.set(name, {
          type: "named",
          token: `@${name}`,
          name,
          ranges: [
            {
              start,
              end: { line, character },
            },
          ],
        });
      } else {
        named.set(name, {
          ...n,
          ranges: [...n.ranges, range],
        });
      }

      continue;
    }

    pointer += 1;
    character += 1;
  }

  return {
    named: Array.from(named.entries()).map(([, n]) => n),
    positional,
  };
};

const tokenChar =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";

const isTokenChar = (c: string | undefined) =>
  c ? tokenChar.indexOf(c) !== -1 : false;
