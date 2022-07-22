import type { Failure } from "./result";
import { unwrap } from "./result";

export type Err<T extends string> = {
  type: T;
  reason: string;
};

export type UnknownError = Err<"Unknown">;

export const errorToString = (err: unknown): string => {
  const failure = err as Failure<Err<string>>;
  if (failure.success === false) {
    const error = unwrap(failure);
    return `${error.type}: ${error.reason}`;
  }

  const error = err as Err<string>;
  if (error.type && error.reason) {
    return `${error.type}: ${error.reason}`;
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
