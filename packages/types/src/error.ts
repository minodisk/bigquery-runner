export type Error<T extends string> = {
  type: T;
  reason: string;
};

export const unknownError = (reason: unknown): Error<"Unknown"> => ({
  type: "Unknown",
  reason: String(reason),
});
