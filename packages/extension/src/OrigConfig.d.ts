// DO NOT EDIT
// This file is generated from gen-src/config.d.ts.ejs.

export type OrigConfig = Readonly<{
  keyFilename: string | undefined;
  projectId: string | undefined;
  location: string | undefined;
  useLegacySql: boolean;
  maximumBytesBilled: string | undefined;
  extensions: Array<string>;
  languageIds: Array<string>;
  icon: boolean;
  defaultDataset: Readonly<{
    datasetId: string | undefined;
    projectId: string | undefined;
  }>;
  downloader: Readonly<{
    csv: Readonly<{
      delimiter: string;
      header: boolean;
    }>;
    rowsPerPage: number | undefined;
  }>;
  tree: Readonly<{
    projectIds: Array<string>;
  }>;
  viewer: Readonly<{
    column: string | number;
    rowsPerPage: number | undefined;
  }>;
  previewer: Readonly<{
    rowsPerPage: number | undefined;
  }>;
  statusBarItem: Readonly<{
    align: "left" | "right" | undefined;
    priority: number | undefined;
  }>;
  validation: Readonly<{
    enabled: boolean;
    debounceInterval: number;
  }>;
  compiler: Readonly<{
    libsRoot: string;
  }>;
}>;
