<!-- DO NOT EDIT
This file is generated from gen-src/README.md.ejs. -->
# BigQuery Runner [![GitHub Actions](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fminodisk%2Fbigquery-runner%2Fbadge%3Fref%3Dmain&style=flat-square)](https://actions-badge.atrox.dev/minodisk/bigquery-runner/goto?ref=main) [![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/minodisk.bigquery-runner?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=minodisk.bigquery-runner) [![Codecov](https://img.shields.io/codecov/c/github/minodisk/bigquery-runner?style=flat-square)](https://app.codecov.io/gh/minodisk/bigquery-runner/)

## Features

An extension to query BigQuery directly and view the results in VSCode.
All operations can be executed by command, and all operations can be configured to be performed from the keyboard.

![Usage](https://user-images.githubusercontent.com/514164/178996200-7f3a1400-9126-412b-b8cf-42d926ddbd58.gif)

- While writing a query:
    - Mark errors in the query.
    - If the query error can be corrected automatically, suggest a candidate for a quick fix.
- When running the query:
    - Run queries from files.
    - Run queries from selected text.
    - Run queries with query parameters.
    - Display the results.
        - Fast rendering of large result tables.
    - Download the results in a variety of formats.
        - JSON Lines
        - JSON
        - CSV
        - Markdown
        - Plain text
- After running the query:
    - Paging the results.
    - Preview the temporary table created by the query.

## Installation

1. Go to [the page of this extension in Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=minodisk.bigquery-runner).
2. Click the `Install` button.
3. This will open the VSCode page for this extension, and click the `Install` button.

## Authentication

This extension requires authentication to the Google Cloud API. You can start using it in the following two steps.

1. [Create a service account and its key](https://cloud.google.com/docs/authentication/getting-started).
    - Give the service account the role of [`roles/bigquery.user`](https://cloud.google.com/bigquery/docs/access-control#bigquery.user).
2. Tell the key path to this extension in one of the following two ways:
    - Set the path to the key `bigqueryRunner.keyFilename` in `settings.json`.
    - [Set the path to environment variable `GOOGLE_APPLICATION_CREDENTIALS`](https://cloud.google.com/docs/authentication/getting-started#setting_the_environment_variable).

## Usage

1. Open a query file with `.bqsql` extension.
2. Open the command palette.
3. Run `BigQuery Runner: Run`.

## Commands

### BigQuery Runner: Run

|ID|
|---|
|bigqueryRunner.run|

Run the query in BigQuery and display the results. If text is selected, it will run the selected text as a query. If no text is selected, the entire file will be executed as a query.

### BigQuery Runner: Previous Page

|ID|
|---|
|bigqueryRunner.prevPage|

Fetch and display the results of the previous page.

### BigQuery Runner: Next Page

|ID|
|---|
|bigqueryRunner.nextPage|

Fetch and display the results of the next page.

### BigQuery Runner: Dry Run

|ID|
|---|
|bigqueryRunner.dryRun|

Dry-run the query in BigQuery and display the result. If there is an error in the query, the wrong token of the query will be marked.

### BigQuery Runner: Download as JSON Lines

|ID|
|---|
|bigqueryRunner.downloadAsJSONL|

Run the query in BigQuery and save the results to a file in JSON Lines format

### BigQuery Runner: Download as JSON

|ID|
|---|
|bigqueryRunner.downloadAsJSON|

Run the query in BigQuery and save the results to a file in JSON format

### BigQuery Runner: Download as CSV

|ID|
|---|
|bigqueryRunner.downloadAsCSV|

Run the query in BigQuery and save the results to a file in CSV format

### BigQuery Runner: Download as Markdown

|ID|
|---|
|bigqueryRunner.downloadAsMarkdown|

Run the query in BigQuery and save the results to a file in Markdown format

### BigQuery Runner: Download as Plain Text

|ID|
|---|
|bigqueryRunner.downloadAsText|

Run the query in BigQuery and save the results to a file in plain text

## Configuration

The extension can be customized by modifying your `settings.json` file. The available configuration options, and their defaults, are below.

### `bigqueryRunner.extensions`

|Type|Default|
|---|---|
|array|[".bqsql",".bqddl",".bqdml"]|

List of file extensions for which the query is to be validated when the file is modified.

### `bigqueryRunner.icon`

|Type|Default|
|---|---|
|boolean|true|

Display GUI button to run on the editor title menu bar.

### `bigqueryRunner.keyFilename`

|Type|Default|
|---|---|
|string &#x7C; null|null|

The path to the JSON file for the service account. If a relative path is specified, it is taken as a path relative to the root folder opened in VSCode. If not specified, the path specified by `GOOGLE_APPLICATION_CREDENTIALS` will be used.

### `bigqueryRunner.languageIds`

|Type|Default|
|---|---|
|array|["bigquery","sql-bigquery"]|

List of [language identifiers](https://code.visualstudio.com/docs/languages/identifiers) of the files whose queries are to be validated when the files are modified.

### `bigqueryRunner.location`

|Type|Default|
|---|---|
|string &#x7C; null|null|

The geographic location of all datasets and jobs referenced and created through this extension. See details at https://cloud.google.com/bigquery/docs/locations#specifying_your_location.

### `bigqueryRunner.maximumBytesBilled`

|Type|Default|
|---|---|
|string &#x7C; null|null|

Limits the bytes billed for this query. Queries with bytes billed above this limit will fail (without incurring a charge). If unspecified, the project default is used.

### `bigqueryRunner.projectId`

|Type|Default|
|---|---|
|string &#x7C; null|null|

Project ID for Google Cloud Platform. If not specified, the value of `project_id` in the JSON file of the service account will be used.

### `bigqueryRunner.useLegacySql`

|Type|Default|
|---|---|
|boolean|false|

Flag whether to use legacy SQL. If `false`, use standard SQL.

### `bigqueryRunner.defaultDataset.datasetId`

|Type|Default|
|---|---|
|string &#x7C; null|null|

Specifies the default datasetId to assume for any unqualified table names in the query. If not set, all table names in the query string must be qualified in the format 'datasetId.tableId'.

### `bigqueryRunner.defaultDataset.projectId`

|Type|Default|
|---|---|
|string &#x7C; null|null|

Specifies the default projectId to assume for any unqualified table names in the query. If `defaultDataset.datasetId` is not set, setting this value has no effect.

### `bigqueryRunner.downloader.csv.delimiter`

|Type|Default|
|---|---|
|string|","|

The delimiter for CSV. For example, if set to `\t`, the output will be formatted as TSV.

### `bigqueryRunner.downloader.csv.header`

|Type|Default|
|---|---|
|boolean|false|

The flag whether to add column names to CSV.

### `bigqueryRunner.downloader.rowsPerPage`

|Type|Default|
|---|---|
|number &#x7C; null|10000|

Maximum number of rows to retrieve per page for downloading. If a number is specified, attempts to fetch that number of rows; if null is specified, attempts to fetch all results. If the amount of data per row is large, the specified number of rows will not always be fetched.

### `bigqueryRunner.viewer.column`

|Type|Default|
|---|---|
|string &#x7C; number|"+1"|

A string such as '+N', '-N' can be set to specify a position relative to the column where the query file is opened. Then, if you set a number greater than 1, the viewer will appear in the specified number of columns from the left. A number of -1 means the viewer will appear in the same column as the query file, and a number of -2 means the viewer will appear in the column farthest to the right.

### `bigqueryRunner.viewer.rowsPerPage`

|Type|Default|
|---|---|
|number &#x7C; null|100|

Maximum number of rows to retrieve per page for display in the viewer. If a number is specified, attempts to fetch that number of rows; if null is specified, attempts to fetch all results. If the amount of data per row is large, the specified number of rows will not always be fetched. You can use the `bigqueryRunner.prevPage` or `bigqueryRunner.nextPage` command to perform paging.

### `bigqueryRunner.statusBarItem.align`

|Type|Default|Enum|
|---|---|---|
|string &#x7C; null|null|"left" &#x7C; "right" &#x7C; null|

The alignment of the status bar item.

### `bigqueryRunner.statusBarItem.priority`

|Type|Default|
|---|---|
|number &#x7C; null|null|

The priority of status bar item. Higher value means the item should be shown more to the left.

### `bigqueryRunner.validation.enabled`

|Type|Default|
|---|---|
|boolean|true|

Validate the query whenever the file set in `languageIds` or `extensions` is modified.

### `bigqueryRunner.validation.debounceInterval`

|Type|Default|
|---|---|
|number|600|

Debounce interval in milliseconds to validate the query when the file is modified.


## Additional Settings

### If you want to use keyboard shortcuts for running and paging

`keybindings.json`:

```json:keybindings.json
{
  {
    "key": "cmd+enter",
    "command": "bigqueryRunner.run",
    "when": "resourceLangId in bigqueryRunner.languageIds || resourceExtname in bigqueryRunner.extensions"
  },
  {
    "key": "space h",
    "command": "bigqueryRunner.prevPage",
    "when": "resourceLangId in bigqueryRunner.languageIds || resourceExtname in bigqueryRunner.extensions && vim.mode == 'Normal' || vim.mode == 'Visual' || vim.mode == 'VisualBlock' || vim.mode == 'VisualLine'"
  },
  {
    "key": "space l",
    "command": "bigqueryRunner.nextPage",
    "when": "resourceLangId in bigqueryRunner.languageIds || resourceExtname in bigqueryRunner.extensions && vim.mode == 'Normal' || vim.mode == 'Visual' || vim.mode == 'VisualBlock' || vim.mode == 'VisualLine'"
  }
}
```

### If you want to syntax highlight a file with `.bqsql` extension as SQL

`settings.json`:

```json:settings.json
{
  "files.associations": {
    "*.bqsql": "sql"
  }
}
```

## License

Apache 2.0 licensed. See the [LICENSE](LICENSE) file for details.
