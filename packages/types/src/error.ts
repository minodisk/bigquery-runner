export type Error<T extends string> = {
  type: T;
  reason: string;
};

export type UnknownError = Error<"Unknown">;

export const errorToString = (err: unknown): string => {
  const e = err as { message: string; toString(): string };
  if (e.message) {
    return e.message;
  }
  if (e.toString) {
    return e.toString();
  }
  return String(e);
};
