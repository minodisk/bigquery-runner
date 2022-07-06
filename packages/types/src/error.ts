import { Failure } from "./result";

export type Error<T extends string> = {
  type: T;
  reason: string;
};

export type UnknownError = Error<"Unknown">;

export const errorToString = (err: unknown): string => {
  const result = err as Failure<Error<string>>;
  if (result.success === false) {
    return `[${result.value.type}] ${result.value.reason}`;
  }
  const e = err as { message: string; toString(): string };
  if (e.message) {
    return e.message;
  }
  if (e.toString) {
    return e.toString();
  }
  return String(e);
};
