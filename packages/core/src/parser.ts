import type {
  Err,
  NamedParamKey,
  ParamKeys,
  PositionalParamKey,
  Result,
} from "shared";
import { fail, succeed } from "shared";

export type MixedError = Err<"Mixed">;

export const parseParameters = (
  query: string
): Result<MixedError, ParamKeys | undefined> => {
  const named = new Map<string, NamedParamKey>();
  const positional: Array<PositionalParamKey> = [];

  let pointer = 0;
  let line = 0;
  let character = 0;
  // let index = 0;
  let comment: "single" | "multi" | null = null;
  let string: {
    quote: "single" | "double";
    lines: "single" | "multi";
  } | null = null;
  while (pointer < query.length) {
    const char0 = query[pointer];
    if (!char0) {
      break;
    }
    const char1 = query[pointer + 1];
    const char2 = query[pointer + 2];
    const char3 = query[pointer + 3];

    // Line break
    if (char0 === "\n") {
      pointer += 1;
      line += 1;
      character = 0;
      // End single-line comment
      if (comment === "single") {
        comment = null;
      }
      continue;
    }
    if (char0 === "\r" && char1 === "\n") {
      pointer += 2;
      line += 1;
      character = 0;
      // End single-line comment
      if (comment === "single") {
        comment = null;
      }
      continue;
    }

    // Ignore escaped quote in single-line string
    if (
      string !== null &&
      string.lines === "single" &&
      char0 === "\\" &&
      ((string.quote === "single" && char1 === "'") ||
        (string.quote === "double" && char1 === '"'))
    ) {
      pointer += 2;
      character += 2;
      continue;
    }

    // Ignore escaped quote in multi-line string
    if (
      string !== null &&
      string.lines === "multi" &&
      char0 === "\\" &&
      ((string.quote === "single" &&
        char1 === "'" &&
        char2 === "'" &&
        char3 === "'") ||
        (string.quote === "double" &&
          char1 === '"' &&
          char2 === '"' &&
          char3 === '"'))
    ) {
      pointer += 4;
      character += 4;
      continue;
    }

    // End multi-line string
    if (
      string !== null &&
      string.lines === "multi" &&
      ((string.quote === "single" &&
        char0 === "'" &&
        char1 === "'" &&
        char2 === "'") ||
        (string.quote === "double" &&
          char0 === '"' &&
          char1 === '"' &&
          char2 === '"'))
    ) {
      pointer += 3;
      character += 3;
      string = null;
      continue;
    }

    // End single-line string
    if (
      string !== null &&
      string.lines === "single" &&
      ((string.quote === "single" && char0 === "'") ||
        (string.quote === "double" && char0 === '"'))
    ) {
      pointer += 1;
      character += 1;
      string = null;
      continue;
    }

    // End asterisk multi-line comment
    if (comment === "multi" && char0 === "*" && char1 === "/") {
      pointer += 2;
      character += 2;
      comment = null;
      continue;
    }

    // During commenting, stop parsing and just move the pointer forward.
    if (comment || string) {
      pointer += 1;
      character += 1;
      continue;
    }

    // Start triple-quoted string
    if (char0 === "'" && char1 === "'" && char2 === "'") {
      pointer += 3;
      character += 3;
      string = {
        quote: "single",
        lines: "multi",
      };
      continue;
    }
    if (char0 === '"' && char1 === '"' && char2 === '"') {
      pointer += 3;
      character += 3;
      string = {
        quote: "double",
        lines: "multi",
      };
      continue;
    }

    // Start quoted string
    if (char0 === "'") {
      pointer += 1;
      character += 1;
      string = {
        quote: "single",
        lines: "single",
      };
      continue;
    }
    if (char0 === '"') {
      pointer += 1;
      character += 1;
      string = {
        quote: "double",
        lines: "single",
      };
      continue;
    }

    // Start sharp single-line comment
    if (char0 === "#") {
      pointer += 1;
      character += 1;
      comment = "single";
      continue;
    }
    // Start dash single-line comment
    if (char0 === "-" && char1 === "-") {
      pointer += 2;
      character += 2;
      comment = "single";
      continue;
    }
    // Start asterisk multi-line comment
    if (char0 === "/" && char1 === "*") {
      pointer += 2;
      character += 2;
      comment = "multi";
      continue;
    }

    // Positional parameter
    if (char0 === "?" && !isTokenChar(char1)) {
      positional.push({
        // type: "positional",
        // token: "?",
        // index,
        range: {
          start: { line, character },
          end: { line, character: character + 1 },
        },
      });

      pointer += 1;
      character += 1;
      // index += 1;
      continue;
    }

    // Named parameter
    if (char0 === "@") {
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
          // type: "named",
          name,
          token: `@${name}`,
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

  const ns = Array.from(named.entries()).map(([, n]) => n);
  if (ns.length > 0 && positional.length > 0) {
    return fail({
      type: "Mixed",
      reason: "Mixed named and positional parameters",
    });
  }
  if (ns.length > 0) {
    return succeed({
      type: "named",
      keys: ns,
    });
  }
  if (positional.length > 0) {
    return succeed({
      type: "positional",
      keys: positional,
    });
  }
  return succeed(undefined);
};

const tokenChar =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";

const isTokenChar = (c: string | undefined) =>
  c ? tokenChar.indexOf(c) !== -1 : false;
