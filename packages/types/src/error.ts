import { Failure, unwrap } from "./result";

export type Error<T extends string> = {
  type: T;
  reason: string;
};

export type UnknownError = Error<"Unknown">;

export const errorToString = (err: unknown): string => {
  const failure = err as Failure<Error<string>>;
  if (failure.success === false) {
    const error = unwrap(failure);
    return `${error.type}: ${error.reason}`;
  }

  const error = err as Error<string>;
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
