import { AST, ColumnRef, Parser } from "node-sql-parser";
import {
  Error,
  errorToString,
  Result,
  succeed,
  tryCatchSync,
  unwrap,
} from "types";

export type BinaryExpr = {
  type: "binary_expr";
  left: Chunk;
  operator: string;
  right: Chunk;
};

export type Chunk = BinaryExpr | ColumnRef | Var | Origin;

export type Var = {
  type: "var";
  prefix: string;
  name: string;
  members: Array<unknown>;
};

export type Origin = {
  type: "origin";
  value: string;
};

export type Params = Readonly<{
  names: ReadonlyArray<string>;
  positions: number;
}>;

export type Traverser = Readonly<{
  params(): Result<Error<"Params">, Params>;
}>;

export const parse = (query: string): Result<Error<"Parse">, Traverser> => {
  const astsResult = tryCatchSync(
    () => {
      const parser = new Parser();
      return parser.astify(query);
    },
    (err) => ({
      type: "Parse" as const,
      reason: errorToString(err),
    })
  );
  if (!astsResult.success) {
    return astsResult;
  }
  const asts = unwrap(astsResult);

  return succeed({
    params() {
      return tryCatchSync(
        () => {
          const findParamsWithAST = (ast: AST, p: Params): Params => {
            if (ast.type !== "select") {
              return p;
            }
            return binaryExpr(ast.where, p);
          };

          const binaryExpr = (b: BinaryExpr, p: Params): Params => {
            return chunk(b.right, chunk(b.left, p));
          };

          const chunk = (c: Chunk, p: Params): Params => {
            if (c.type === "var" && c.prefix === "@") {
              return {
                ...p,
                names: [...p.names, c.name],
              };
            }
            if (c.type === "origin" && c.value === "?") {
              return {
                ...p,
                positions: p.positions + 1,
              };
            }
            if (c.type === "binary_expr") {
              return binaryExpr(c, p);
            }
            if (c.type === "column_ref") {
              return p;
            }
            return p;
          };

          {
            const params: Params = { names: [], positions: 0 };
            if (Array.isArray(asts)) {
              return asts.reduce((p, ast) => findParamsWithAST(ast, p), params);
            }
            return findParamsWithAST(asts, params);
          }
        },
        (err) => ({
          type: "Params",
          reason: errorToString(err),
        })
      );
    },
  });
};
