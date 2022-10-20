import type { Token } from "core";
import ordinal from "ordinal";
import type { Err, Result, RunnerID } from "shared";
import { errorToString, succeed, tryCatchSync } from "shared";
import type { ExtensionContext } from "vscode";
import { window } from "vscode";
import type { Logger } from "./logger";

export type ParamManager = ReturnType<typeof createParamManager>;
export type Manager = {
  get(
    tokens: Array<Token>
  ): Promise<
    Result<
      Err<"NoParameter" | "InvalidJSON">,
      { [key: string]: unknown } | Array<unknown> | undefined
    >
  >;
  clearParams(): Promise<void>;
};

export const createParamManager = ({
  state,
  logger,
}: {
  state: ExtensionContext["globalState"];
  logger: Logger;
}) => {
  const managers = new Map<RunnerID, Manager>();
  const l = logger.createChild("ParamManager");
  return {
    get({ runnerId }: { runnerId: RunnerID }) {
      return managers.get(runnerId);
    },

    create({ runnerId }: { runnerId: RunnerID }) {
      const manager = managers.get(runnerId);
      if (manager) {
        return manager;
      }
      const m: Manager = {
        async get(tokens) {
          const cache = state.get<{ [key: string]: unknown } | Array<string>>(
            runnerId
          );
          l.log("cache:", JSON.stringify(cache));

          {
            const paramTokens = tokens.filter(
              (token) => token.type === "NAMED_PARAMETER"
            );
            if (paramTokens.length > 0) {
              const map = paramTokens.reduce((m, token) => {
                const key = token.key ?? token.raw.replace(/^@/, "");
                const tokens = m.get(key);
                m.set(key, tokens ? [...tokens, token] : [token]);
                return m;
              }, new Map<string, Array<Token>>());
              {
                if (
                  cache &&
                  !Array.isArray(cache) &&
                  equals(Object.keys(cache), Array.from(map.keys()))
                ) {
                  l.log("use cache:", JSON.stringify(cache));
                  return succeed(cache);
                }
              }
              const values: { [key: string]: unknown } = {};
              for (const [key] of map) {
                const value = await window.showInputBox({
                  title: `Set a parameter to "${key}"`,
                  prompt: `Specify in JSON format`,
                });
                if (value === undefined) {
                  return fail({
                    type: "NoParameter" as const,
                    reason: `Parameter "${key}" is not specified`,
                  });
                }
                const parseJSONResult = parseJSON(value);
                if (!parseJSONResult.success) {
                  return parseJSONResult;
                }
                values[key] = parseJSONResult.value;
              }
              await state.update(runnerId, values);
              return succeed(values);
            }
          }

          {
            const paramTokens = tokens.filter(
              (token) => token.type === "POSITIONAL_PARAMETER"
            );
            if (paramTokens.length > 0) {
              {
                if (
                  cache &&
                  Array.isArray(cache) &&
                  cache.values.length === paramTokens.length
                ) {
                  l.log("use cache:", JSON.stringify(cache));
                  return succeed(cache);
                }
              }

              const values: Array<unknown> = [];
              for (let i = 0; i < paramTokens.length; i++) {
                const key = ordinal(i + 1);
                const value = await window.showInputBox({
                  title: `Set a parameter for the ${key} param`,
                  prompt: `Specify in JSON format`,
                });
                if (value === undefined) {
                  return fail({
                    type: "NoParameter" as const,
                    reason: `${key} parameter is not specified`,
                  });
                }
                const parseJSONResult = parseJSON(value);
                if (!parseJSONResult.success) {
                  return parseJSONResult;
                }
                values[i] = parseJSONResult.value;
              }
              await state.update(runnerId, values);
              return succeed(values);
            }
          }

          return succeed(undefined);
        },

        async clearParams() {
          await Promise.all([
            state.update(`${runnerId}`, undefined),
            state.update(`${runnerId}-named`, undefined),
            state.update(`${runnerId}-positional`, undefined),
          ]);
        },
      };
      managers.set(runnerId, m);
      return m;
    },

    async clearAllParams() {
      await Promise.all(
        state.keys().map((key) => state.update(key, undefined))
      );
    },

    dispose() {
      managers.clear();
    },
  };
};

const parseJSON = (value: string): Result<Err<"InvalidJSON">, unknown> => {
  return tryCatchSync(
    () => JSON.parse(value),
    (err) => ({
      type: "InvalidJSON",
      reason: errorToString(err),
    })
  );
};
const equals = <T>(a: Array<T>, b: Array<T>): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);
