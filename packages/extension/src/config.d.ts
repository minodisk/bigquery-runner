// DO NOT EDIT
// This file is generated from gen-src/config.d.ts.ejs.

export type Config = {
  readonly keyFilename: string | undefined;
  readonly projectId: string | undefined;
  readonly location: string | undefined;
  readonly useLegacySql: boolean;
  readonly maximumBytesBilled: string | undefined;
  readonly queryValidation: {
    readonly enabled: boolean;
    readonly debounceInterval: number;
    readonly languageIds: Array<string>;
    readonly extensions: Array<string>;
  };
  readonly pagination: {
    readonly results: number | undefined;
  };
  readonly format: {
    readonly type: "table" | "markdown" | "json" | "json-lines" | "csv";
    readonly csv: {
      readonly header: boolean;
      readonly delimiter: string;
    };
  };
  readonly output: {
    readonly type: "viewer" | "log" | "file";
    readonly file: {
      readonly path: string;
    };
    readonly viewer: {
      readonly column: string | number;
    };
  };
  readonly statusBarItem: {
    readonly align: "left" | "right" | undefined;
    readonly priority: number | undefined;
  };
};
