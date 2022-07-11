export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };

export type Parameter =
  | {
      type: "named";
      token: `@${string}`;
      name: string;
      range: Range;
    }
  | {
      type: "positional";
      token: "?";
      index: number;
      range: Range;
    };

export const parse = (query: string): ReadonlyArray<Parameter> => {
  const params: Array<Parameter> = [];

  let pointer = 0;
  let line = 0;
  let character = 0;
  let index = 0;
  while (pointer < query.length) {
    const curr = query[pointer];
    if (!curr) {
      break;
    }
    const next = query[pointer + 1];

    if (curr === "\n") {
      pointer += 1;
      line += 1;
      character = 0;
      continue;
    }
    if (curr === "\r" && next === "\n") {
      pointer += 2;
      line += 1;
      character = 0;
      continue;
    }

    if (curr === "?" && !isTokenChar(next)) {
      params.push({
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

      params.push({
        type: "named",
        token: `@${name}`,
        name,
        range: {
          start,
          end: { line, character },
        },
      });

      continue;
    }

    pointer += 1;
    character += 1;
  }

  return params;
};

const tokenChar =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";

const isTokenChar = (c: string | undefined) =>
  c ? tokenChar.indexOf(c) !== -1 : false;
