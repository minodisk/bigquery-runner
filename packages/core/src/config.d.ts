// DO NOT EDIT
// This file is generated from gen-src/config.d.ts.ejs.
export type Config = {
  readonly keyFilename: string;
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
  readonly format: {
    readonly type: "table" | "markdown" | "json" | "json-lines" | "csv";
    readonly csv: {
      readonly header: boolean;
      readonly delimiter: string;
    };
  };
  readonly output: {
    readonly type: "viewer" | "output" | "file";
    readonly file: {
      readonly path: string;
    };
  };
};
