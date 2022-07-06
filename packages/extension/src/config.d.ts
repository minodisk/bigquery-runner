// DO NOT EDIT
// This file is generated from gen-src/config.d.ts.ejs.

export type Config = {
  readonly extensions: Array<string>;
  readonly icon: boolean;
  readonly keyFilename: string | undefined;
  readonly languageIds: Array<string>;
  readonly location: string | undefined;
  readonly maximumBytesBilled: string | undefined;
  readonly projectId: string | undefined;
  readonly useLegacySql: boolean;
  readonly downloader: {
    readonly csv: {
      readonly delimiter: string;
      readonly header: boolean;
    };
    readonly rowsPerPage: number | undefined;
  };
  readonly viewer: {
    readonly column: string | number;
    readonly rowsPerPage: number | undefined;
  };
  readonly statusBarItem: {
    readonly align: "left" | "right" | undefined;
    readonly priority: number | undefined;
  };
  readonly validation: {
    readonly enabled: boolean;
    readonly debounceInterval: number;
  };
};
