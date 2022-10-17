import ordinal from "ordinal";
import type {
  Err,
  NamedParamKey,
  NamedParamValue,
  NamedParamValues,
  ParamKeys,
  ParamValues,
  PositionalParamKey,
  PositionalParamValue,
  PositionalParamValues,
  Result,
  RunnerID,
} from "shared";
import {
  isPositionalParamKeys,
  isNamedParamKeys,
  errorToString,
  succeed,
  tryCatchSync,
} from "shared";
import type { ExtensionContext } from "vscode";
import { window } from "vscode";
import type { Logger } from "./logger";

export type ParamManager = ReturnType<typeof createParamManager>;
export type Manager = {
  get(
    keys: ParamKeys
  ): Promise<Result<Err<"InvalidJSON">, ParamValues | undefined>>;
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
        async get(paramKeys) {
          l.log("get:", JSON.stringify(paramKeys));
          if (isNamedParamKeys(paramKeys)) {
            const key = `${runnerId}-named`;
            const values = state.get<NamedParamValues>(key);
            l.log("values:", JSON.stringify(values));
            if (values) {
              return succeed(values);
            }
            const getNamedParamValuesResult = await getNamedParamValues(
              paramKeys.keys
            );
            if (!getNamedParamValuesResult.success) {
              return getNamedParamValuesResult;
            }
            const namedParamValues = {
              type: "named" as const,
              values: getNamedParamValuesResult.value,
            };
            await state.update(key, namedParamValues);
            return succeed(namedParamValues);
          }
          if (isPositionalParamKeys(paramKeys)) {
            const key = `${runnerId}-positional`;
            const values = state.get<PositionalParamValues>(key);
            if (values) {
              return succeed(values);
            }
            const getPositionalParamValuesResult =
              await getPositionalParamValues(paramKeys.keys);
            if (!getPositionalParamValuesResult.success) {
              return getPositionalParamValuesResult;
            }
            const positionalParamValues = {
              type: "positional" as const,
              values: getPositionalParamValuesResult.value,
            };
            await state.update(key, positionalParamValues);
            return succeed(positionalParamValues);
          }
          return succeed(undefined);
        },

        async clearParams() {
          await Promise.all([
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

const getNamedParamValues = async (
  named: ReadonlyArray<NamedParamKey>
): Promise<Result<Err<"InvalidJSON">, ReadonlyArray<NamedParamValue>>> => {
  const values: Array<NamedParamValue> = [];
  for (const { name, token } of named) {
    const value = await window.showInputBox({
      title: `Set a parameter to ${token}`,
      prompt: `Specify in JSON format`,
    });
    if (value === undefined) {
      continue;
    }
    const parseJSONResult = parseJSON(value);
    if (!parseJSONResult.success) {
      return parseJSONResult;
    }
    values.push({ name, value: parseJSONResult.value });
  }
  return succeed(values);
};

const getPositionalParamValues = async (
  positional: ReadonlyArray<PositionalParamKey>
): Promise<Result<Err<"InvalidJSON">, ReadonlyArray<PositionalParamValue>>> => {
  const values: Array<PositionalParamValue> = [];
  for (let i = 0; i < positional.length; i++) {
    const value = await window.showInputBox({
      title: `Set a parameter for the ${ordinal(i + 1)} param`,
      prompt: `Specify in JSON format`,
    });
    if (value === undefined) {
      continue;
    }
    const parseJSONResult = parseJSON(value);
    if (!parseJSONResult.success) {
      return parseJSONResult;
    }
    values[i] = { value: parseJSONResult.value };
  }
  return succeed(values);
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
