export type Result<F, S> = Failure<F> | Success<S>;

export type Failure<F> = Readonly<{
  success: false;
  value: F;
}>;

export const fail = <F>(value: F): Failure<F> => ({
  success: false,
  value,
});

export type Success<S> = Readonly<{
  success: true;
  value: S;
}>;

export const succeed = <S>(value: S): Success<S> => ({
  success: true,
  value,
});

export const unwrap = <T>({ value }: { value: T }): T => value;

export const tryCatchSync = <F, S>(
  tryFn: () => S,
  catchFn: (err: unknown) => F
): Result<F, S> => {
  try {
    return succeed(tryFn());
  } catch (err) {
    return fail(catchFn(err));
  }
};

export const tryCatch = async <F, S>(
  tryFn: () => Promise<S>,
  catchFn: (err: unknown) => F
): Promise<Result<F, S>> => {
  try {
    return succeed(await tryFn());
  } catch (err) {
    return fail(catchFn(err));
  }
};
