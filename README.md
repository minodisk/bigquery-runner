<!-- DO NOT EDIT
This file is generated from gen-src/README.md.ejs. -->
# BigQuery Runner [![GitHub Actions](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fminodisk%2Fbigquery-runner%2Fbadge%3Fref%3Dmain&style=flat-square)](https://actions-badge.atrox.dev/minodisk/bigquery-runner/goto?ref=main) [![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/minodisk.bigquery-runner?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=minodisk.bigquery-runner) [![Codecov](https://img.shields.io/codecov/c/github/minodisk/bigquery-runner?style=flat-square)](https://app.codecov.io/gh/minodisk/bigquery-runner/)

## Installation

1. Go to [the page of this extension in Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=minodisk.bigquery-runner)
2. Click the `Install` button
3. This will open the VS Code page for this extension, and click the `Install` button

## Authentication

This extension requires authentication to the Google Cloud API. You can start using it in the following two steps.

1. [Create a service account and its key](https://cloud.google.com/docs/authentication/getting-started)
    - Give the service account the role of [`roles/bigquery.user`](https://cloud.google.com/bigquery/docs/access-control#bigquery.user)
2. Tell the key path to this extension in one of the following two ways:
    - Set the path to the key `bigqueryRunner.keyFilename` in settings.json
    - [Set the path to environment variable `GOOGLE_APPLICATION_CREDENTIALS`](https://cloud.google.com/docs/authentication/getting-started#setting_the_environment_variable)

## Usage

1. Open a query file with `.bqsql` extension
2. Open the command palette
3. Run `BigQuery Runner: Run`

![bigquery-runner-12 1](https://user-images.githubusercontent.com/514164/150627625-2cca91ec-c0fc-47f2-a157-4704b44b8e04.gif)


## Commands

### BigQuery Runner: Run

|ID|
|---|
|bigqueryRunner.run|

Run a query in BigQuery and display the results. If text is selected, it will run the selected text as a query. If no text is selected, the entire file will be executed as a query.

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

Dry-run a query in BigQuery and display the result. If there is an error in the query, the wrong token of the query will be marked.

## Configuration

The extension can be customized by modifying your `settings.json` file. The available configuration options, and their defaults, are below.

### `bigqueryRunner.keyFilename`

|Type|Default|
|---|---|
|string &#x7C; null|null|

The path to the JSON file for the service account. If a relative path is specified, it is taken as a path relative to the root folder opened in VS Code. If not specified, the path specified by `GOOGLE_APPLICATION_CREDENTIALS` will be used.

### `bigqueryRunner.projectId`

|Type|Default|
|---|---|
|string &#x7C; null|null|

Project ID for Google Cloud Platform. If not specified, the value of `project_id` in the JSON file of the service account will be used.

### `bigqueryRunner.location`

|Type|Default|
|---|---|
|string &#x7C; null|null|

The geographic location of all datasets and jobs referenced and created through this extension. See details at https://cloud.google.com/bigquery/docs/locations#specifying_your_location.

### `bigqueryRunner.useLegacySql`

|Type|Default|
|---|---|
|boolean|false|

Flag whether to use legacy SQL. If `false`, use standard SQL.

### `bigqueryRunner.maximumBytesBilled`

|Type|Default|
|---|---|
|string &#x7C; null|null|

Limits the bytes billed for this query. Queries with bytes billed above this limit will fail (without incurring a charge). If unspecified, the project default is used.

### `bigqueryRunner.queryValidation.enabled`

|Type|Default|
|---|---|
|boolean|true|

Validate the query whenever the file set in `queryValidation.languageIds` or `queryValidation.extensions` is modified.

### `bigqueryRunner.queryValidation.debounceInterval`

|Type|Default|
|---|---|
|number|600|

Debounce interval in milliseconds to validate the query when the file is modified.

### `bigqueryRunner.queryValidation.languageIds`

|Type|Default|
|---|---|
|array|["bigquery","sql-bigquery"]|

List of [language identifiers](https://code.visualstudio.com/docs/languages/identifiers) of the files whose queries are to be validated when the files are modified.

### `bigqueryRunner.queryValidation.extensions`

|Type|Default|
|---|---|
|array|[".bqsql",".bqddl",".bqdml"]|

List of file extensions for which the query is to be validated when the file is modified.

### `bigqueryRunner.pagination.results`

|Type|Default|
|---|---|
|number &#x7C; null|100|

The number of rows per page. If a number is specified, only that number of rows will be fetched and displayed as a result. If null is specified, all results will be fetched and displayed. Paging by command `bigqueryRunner.prevPage` or `bigqueryRunner.nextPage`.

### `bigqueryRunner.format.type`

|Type|Default|Enum|
|---|---|---|
|string|"table"|"table" &#x7C; "markdown" &#x7C; "json" &#x7C; "json-lines" &#x7C; "csv"|

Formatting method.

### `bigqueryRunner.format.csv.header`

|Type|Default|
|---|---|
|boolean|false|

The flag whether to add column names to CSV.

### `bigqueryRunner.format.csv.delimiter`

|Type|Default|
|---|---|
|string|","|

The delimiter for CSV. For example, if set to 	, the output will be formatted as TSV.

### `bigqueryRunner.output.type`

|Type|Default|Enum|
|---|---|---|
|string|"viewer"|"viewer" &#x7C; "log" &#x7C; "file"|

The output destination for the query results.  When set to `viewer`, this extension opens the webview pane and renders the results with <table> tags. When set to `log`, this extension opens the output panel and outputs the results in the format set in `bigqueryRunner.format.type`. When set to `file`, this extension outputs the results as a file in the directory set in `bigqueryRunner.output.file.path`, in the format set in  `bigqueryRunner.format.type`.

### `bigqueryRunner.output.file.path`

|Type|Default|
|---|---|
|string|"."|

The output directory of the file when `bigqueryRunner.output.type` is specified as `file`.

### `bigqueryRunner.output.viewer.column`

|Type|Default|
|---|---|
|string &#x7C; number|"+1"|

A string such as '+N', '-N' can be set to specify a position relative to the column where the query file is opened. Then, if you set a number greater than 1, the viewer will appear in the specified number of columns from the left. A number of -1 means the viewer will appear in the same column as the query file, and a number of -2 means the viewer will appear in the column farthest to the right.

### `bigqueryRunner.icon`

|Type|Default|
|---|---|
|boolean|true|

Display GUI button to run on the editor title menu bar.

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


## Features

- Write SQL in VS Code and query BigQuery datasets directly
- Query from selected text
- Marking errors in a query
- Fast rendering of huge results
- Pagination
- Format in a variety of formats
    - HTML `<table>`
    - Text neatly formatted into a table
    - JSON
    - JSON Lines
    - CSV
- Output to various destinations
    - Viewer that is highly compatible with the themes and fonts set in your VS Code
    - Log window, the UI of VS Code
    - File

## Additional Settings

### If you want to use keyboard shortcuts for running and paging

`keybindings.json`:

```json:keybindings.json
{
  {
    "key": "cmd+enter",
    "command": "bigqueryRunner.run",
    "when": "resourceExtname == '.bqsql'"
  },
  {
    "key": "space h",
    "command": "bigqueryRunner.prevPage",
    "when": "!terminalFocus && resourceExtname == '.bqsql' && vim.mode == 'Normal' || vim.mode == 'Visual' || vim.mode == 'VisualBlock' || vim.mode == 'VisualLine'"
  },
  {
    "key": "space l",
    "command": "bigqueryRunner.nextPage",
    "when": "!terminalFocus && resourceExtname == '.bqsql' && vim.mode == 'Normal' || vim.mode == 'Visual' || vim.mode == 'VisualBlock' || vim.mode == 'VisualLine'"
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

### If `bigqueryRunner.output.type` is set as `log` and word wrap causes the table to collapse

`settings.json`:

```json:settings.json
{
  "[Log]": {
    "editor.wordWrap": "off"
  }
}
```

## License

Apache 2.0 licensed. See the LICENSE file for details.
