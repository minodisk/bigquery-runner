export type Error<T extends string> = {
  type: T;
  reason: string;
};

export type UnknownError = Error<"Unknown">;
