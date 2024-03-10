<!-- DO NOT EDIT
This file is generated from gen-src/README.md.ejs. -->
# BigQuery Runner [![GitHub Actions](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fminodisk%2Fbigquery-runner%2Fbadge%3Fref%3Dmain&style=flat-square)](https://actions-badge.atrox.dev/minodisk/bigquery-runner/goto?ref=main) [![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/minodisk.bigquery-runner?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=minodisk.bigquery-runner) [![Codecov](https://img.shields.io/codecov/c/github/minodisk/bigquery-runner?style=flat-square)](https://app.codecov.io/gh/minodisk/bigquery-runner/)

An extension to query BigQuery directly and view the results in VSCode.

![Preview](https://user-images.githubusercontent.com/514164/180352233-ed635538-f064-4389-814a-c3ec306aa832.gif)

## Features

- Mark errors in queries.
    - If the query error can be corrected automatically, suggest a candidate for a quick fix.
- Run queries:
    - from files.
    - from selected text.
    - with query parameters.
- Display the results in viewers:
    - Rows
        - Fast rendering of large result tables.
        - Pagination.
        - Can be downloaded as a file.
    - Table
        - Temporary tables can be opened in yet another viewer.
    - Schema
    - Routine
    - Job
- Download the rows in a variety of formats, both from the viewer and from the query file:
    - JSON Lines
    - JSON
    - CSV
    - Markdown
    - Plain text
        - Pretty formatted text like a table.
- All operations can be executed from [commands](#commands).
    - Therefore, it can be set to be performed with [keyboard shortcuts](#keyboard-shortcuts).
    - Of course, it can also be operated from the GUI.

## Installation

1. Go to [the page of this extension in Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=minodisk.bigquery-runner).
2. Click the `Install` button.
3. This will open the VSCode page for this extension, and click the `Install` button.

## Authentication

This extension requires authentication to the Google Cloud API. You can get started by authenticating in one of the following two ways.

### Gcloud Credential ([Recommended](https://cloud.google.com/iam/docs/best-practices-service-accounts#development))

<!-- 1. [Install the gcloud CLI](https://cloud.google.com/sdk/docs/install).
1. Run `BigQuery Runner: Login` in the VSCode command palette.
1. Set `bigqueryRunner.projectId` in `setting.json`.

or -->

1. [Install the gcloud CLI](https://cloud.google.com/sdk/docs/install).
1. Run [`gcloud auth application-default login`](https://cloud.google.com/sdk/gcloud/reference/auth/application-default) in your terminal.
1. Set `bigqueryRunner.projectId` in `setting.json`.

- Don't set `bigqueryRunner.keyFilename` in `setting.json`.
- Don't set `GOOGLE_APPLICATION_CREDENTIALS` as an environment variable.

### Service Account Key

1. [Create a service account and its key](https://cloud.google.com/docs/authentication/getting-started).
    - Give the service account the necessary roles. Such as [`roles/bigquery.user`](https://cloud.google.com/bigquery/docs/access-control#bigquery.user) for example.
1. Tell the key path to this extension in one of the following two ways:
    - Set the path to the key `bigqueryRunner.keyFilename` in `settings.json`.
    - [Set the path to the key as the environment variable `GOOGLE_APPLICATION_CREDENTIALS`](https://cloud.google.com/docs/authentication/getting-started#setting_the_environment_variable).

## Usage

1. Open a query file with `.bqsql` extension.
1. Open the command palette.
1. Run `BigQuery Runner: Run`.

### Query parameters

If query has one or more named parameters, the extension will ask you for the values of that parameter. The values must be given in JSON format, e.g. quotation marks should be used for simple values such as `"20231224"`. See below for more complex examples.

Once set, the parameters are saved for future use and should be reset if necessary using the [bigqueryRunner.clearParams](#bigquery-runner-clear-parameters) command.

![Parameters usage](https://user-images.githubusercontent.com/514164/178248203-a24126dc-4ade-4e6f-93ae-200702edfa51.gif)

## Commands

### BigQuery Runner: Login

|ID|
|---|
|bigqueryRunner.login|

Login with `gcloud auth application-default login`.

### BigQuery Runner: Logout

|ID|
|---|
|bigqueryRunner.logout|

Logout with `gcloud auth application-default revoke`.

### BigQuery Runner: Run

|ID|
|---|
|bigqueryRunner.run|

Run the query in BigQuery and display the results. If text is selected, it will run the selected text as a query. If no text is selected, the entire file will be executed as a query.

### BigQuery Runner: Dry Run

|ID|
|---|
|bigqueryRunner.dryRun|

Dry-run the query in BigQuery and display the result. If there is an error in the query, the wrong token of the query will be marked.

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

### BigQuery Runner: Focus on Left Tab

|ID|
|---|
|bigqueryRunner.focusOnLeftTab|

Focus on the left tab in the viewer.

### BigQuery Runner: Focus on Right Tab

|ID|
|---|
|bigqueryRunner.focusOnRightTab|

Focus on the right tab in the viewer.

### BigQuery Runner: Focus on Rows Tab

|ID|
|---|
|bigqueryRunner.focusOnRowsTab|

Focus on the rows tab in the viewer.

### BigQuery Runner: Focus on Table Tab

|ID|
|---|
|bigqueryRunner.focusOnTableTab|

Focus on the table tab in the viewer.

### BigQuery Runner: Focus on Schema Tab

|ID|
|---|
|bigqueryRunner.focusOnSchemaTab|

Focus on the schema tab in the viewer.

### BigQuery Runner: Focus on Routine Tab

|ID|
|---|
|bigqueryRunner.focusOnRoutineTab|

Focus on the routine tab in the viewer.

### BigQuery Runner: Focus on Job Tab

|ID|
|---|
|bigqueryRunner.focusOnJobTab|

Focus on the job tab in the viewer.

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

### BigQuery Runner: Refresh Resources

|ID|
|---|
|bigqueryRunner.refreshResources|

Refresh the BigQuery Runner's Resources

### BigQuery Runner: Copy Table ID

|ID|
|---|
|bigqueryRunner.copyTableId|

Copy the selected table ID to the clipboard

### BigQuery Runner: Preview Table in VS Code

|ID|
|---|
|bigqueryRunner.previewTableInVSCode|

Preview the selected table in VS Code

### BigQuery Runner: Preview Table on Remote

|ID|
|---|
|bigqueryRunner.previewTableOnRemote|

Preview the selected table in Google Cloud Console

### BigQuery Runner: Copy Field Name

|ID|
|---|
|bigqueryRunner.copyFieldName|

Copy the selected field name to the clipboard

### BigQuery Runner: Clear Parameters

|ID|
|---|
|bigqueryRunner.clearParams|

Clear the stored parameters for active text editor.

### BigQuery Runner: Clear All Parameters

|ID|
|---|
|bigqueryRunner.clearAllParams|

Clear all stored parameters.

## Configuration

The extension can be customized by modifying your `settings.json` file. The available configuration options, and their defaults, are below.

### `bigqueryRunner.keyFilename`

|Type|Default|
|---|---|
|string &#x7C; null|null|

The path to the JSON file for the service account. If a relative path is specified, it is taken as a path relative to the root folder opened in VSCode. If not specified, the path specified by `GOOGLE_APPLICATION_CREDENTIALS` will be used.

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

Limits the bytes billed for this query. Queries with bytes billed above this limit will fail (without incurring a charge). Can be set in units, for example `200GB`. If unspecified, the project default is used.

### `bigqueryRunner.extensions`

|Type|Default|
|---|---|
|array|[".bqsql",".bqddl",".bqdml"]|

List of file extensions for which the query is to be validated when the file is modified.

### `bigqueryRunner.languageIds`

|Type|Default|
|---|---|
|array|["bigquery","sql-bigquery"]|

List of [language identifiers](https://code.visualstudio.com/docs/languages/identifiers) of the files whose queries are to be validated when the files are modified.

### `bigqueryRunner.icon`

|Type|Default|
|---|---|
|boolean|true|

Display GUI button to run on the editor title menu bar.

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

### `bigqueryRunner.tree.projectIds`

|Type|Default|
|---|---|
|array|[]|

Array of projects for the datasets to be displayed in the tree view. If empty, only datasets in a project that have been authenticated will be displayed in the tree view.

### `bigqueryRunner.viewer.column`

|Type|Default|
|---|---|
|string &#x7C; number|"+1"|

A string such as '+N', '-N' can be set to specify a position relative to the column where the query file is opened. Then, if you set a number greater than 1, the viewer will appear in the specified number of columns from the left. A number of -1 means the viewer will appear in the same column as the query file, and a number of -2 means the viewer will appear in the column farthest to the right.

### `bigqueryRunner.previewer.rowsPerPage`

|Type|Default|
|---|---|
|number &#x7C; null|100|

Maximum number of rows to retrieve per page for preview. If a number is specified, attempts to fetch that number of rows; if null is specified, attempts to fetch all results. If the amount of data per row is large, the specified number of rows will not always be fetched.

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

### `bigqueryRunner.viewer.rowsPerPage`

|Type|Default|
|---|---|
|number &#x7C; null|100|

Maximum number of rows to retrieve per page for display in the viewer. If a number is specified, attempts to fetch that number of rows; if null is specified, attempts to fetch all results. If the amount of data per row is large, the specified number of rows will not always be fetched. You can use the `bigqueryRunner.prevPage` or `bigqueryRunner.nextPage` command to perform paging.


## Additional Settings

### Keyboard shortcuts

`keybindings.json`:

```json:keybindings.json
[
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
]
```

### Syntax highlighting `.bqsql` files as SQL

`settings.json`:

```json:settings.json
{
  "files.associations": {
    "*.bqsql": "sql"
  }
}
```

## More documents

### Changelog

If you want to know the difference between each release, see [CHANGELOG.md](CHANGELOG.md)

### Contributing

When you create an issue, pull request, or fork see [CONTRIBUTING.md](CONTRIBUTING.md)

### License

Apache 2.0 licensed. See the [LICENSE](LICENSE) file for details.
This extension is forked from [google/vscode-bigquery](https://github.com/google/vscode-bigquery).
