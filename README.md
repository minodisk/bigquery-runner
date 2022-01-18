<!-- DO NOT EDIT
This file is generated from gen-src/README.md.ejs. -->
# BigQuery Runner

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/minodisk.bigquery-runner?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=minodisk.bigquery-runner)
[![GitHub Actions](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fminodisk%2Fbigquery-runner%2Fbadge%3Fref%3Dmain&style=flat-square)](https://actions-badge.atrox.dev/minodisk/bigquery-runner/goto?ref=main)
[![Codecov](https://img.shields.io/codecov/c/github/minodisk/bigquery-runner?style=flat-square)](https://app.codecov.io/gh/minodisk/bigquery-runner/)

A Visual Studio Code extension that can query Google Cloud Platform's [BigQuery](https://cloud.google.com/bigquery/) from, and return results to, your editor. This extension allows you to:

- Write SQL in VSCode and query BigQuery datasets directly
- Create queries from selected text
- Capture results into VSCode window to manipulate them further
- Mark the location of errors encountered during the execution of a query job in the editor

This extension is great if you're exploring BigQuery and prefer VSCode's editing environment, or for cases where you're writing documentation (hint: use "Run selected text as query") and want to double check that the query is valid.

This extension was forked from [google/vscode-bigquery](https://github.com/google/vscode-bigquery).

## Installing

[BigQuery Runner \- Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=minodisk.bigquery-runner)

## Usage

The BigQuery extension adds a number of commands to the command palette (Cmd/Ctrl+Shift+P).

By default, it will look for your `GOOGLE_APPLICATION_CREDENTIALS` environmental variable (if set) and use the service account described in that JSON file. You can also explicitly set `bigqueryRunner.keyFilename` to the path of your [Service Account key file](https://cloud.google.com/docs/authentication/getting-started). Unless necessary, it's recommended that you scope this key to the [`roles.bigquery.user`](https://cloud.google.com/bigquery/docs/access-control#permissions_and_roles) role, which is sufficient for querying and most related tasks.

## Commands

![bigquery-runner-12](https://user-images.githubusercontent.com/514164/149955294-1f740196-5295-4286-8b1f-e9dfb2958cc6.gif)

### BigQuery Runner: Run

|ID|
|---|
|bigqueryRunner.run|

Run the query with BigQuery and display the results. Run the query on the selected text if text is selected, or on the entire file if no text is selected.

### BigQuery Runner: Previous Page

|ID|
|---|
|bigqueryRunner.prevPage|

Fetch and display the previous page.

### BigQuery Runner: Next Page

|ID|
|---|
|bigqueryRunner.nextPage|

Fetch and display the next page.

### BigQuery Runner: Dry Run

|ID|
|---|
|bigqueryRunner.dryRun|

Run the dry run query with BigQuery and display the result. Run the query on the selected text if text is selected, or on the entire file if no text is selected.

## Configuration

The extension can be customized by modifying your `settings.json` file. The available configuration options, and their defaults, are below.

### `bigqueryRunner.keyFilename`

|Type|Default|
|---|---|
|string &#x7C; null|null|

The path to the JSON file for the service account. When specifying a relative path, specify the path from the root folder that is open in VSCode. If it is not specified, the path specified in `GOOGLE_APPLICATION_CREDENTIALS` is used.

### `bigqueryRunner.projectId`

|Type|Default|
|---|---|
|string &#x7C; null|null|

Project ID for Google Cloud Platform. If not specified, the value of `project_id` in the JSON file of the service account will be used.

### `bigqueryRunner.location`

|Type|Default|
|---|---|
|string &#x7C; null|null|

The geographic location where the job should run. See details at https://cloud.google.com/bigquery/docs/locations#specifying_your_location.

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
![bigqueryRunner.queryValidation.enabled](https://storage.googleapis.com/bigquery-runner/query-validation.gif)

### `bigqueryRunner.queryValidation.debounceInterval`

|Type|Default|
|---|---|
|number|600|

Debounce interval in milliseconds to validate the query when the file is modified.

### `bigqueryRunner.queryValidation.languageIds`

|Type|Default|
|---|---|
|array|["bigquery","sql-bigquery"]|

List of language IDs of the files whose queries are to be validated when the files are modified.

### `bigqueryRunner.queryValidation.extensions`

|Type|Default|
|---|---|
|array|[".bqsql",".bqddl",".bqdml"]|

List of file extensions for which the query is to be validated when the file is modified.

### `bigqueryRunner.pagination.results`

|Type|Default|
|---|---|
|number &#x7C; null|100|

The number of rows per page. If a number is specified, only that number of rows will be fetched and displayed as a result. If null is specified, all results will be displayed. Paging by command `bigqueryRunner.prevPage` or `bigqueryRunner.nextPage`.

### `bigqueryRunner.format.type`

|Type|Default|Enum|
|---|---|---|
|string|"table"|"table" &#x7C; "markdown" &#x7C; "json" &#x7C; "json-lines" &#x7C; "csv"|

Controls the output format for query results.

### `bigqueryRunner.format.csv.header`

|Type|Default|
|---|---|
|boolean|false|

Columns names are automatically discovered from the first record if it is provided as a literal object.

### `bigqueryRunner.format.csv.delimiter`

|Type|Default|
|---|---|
|string|","|

Set the delimiter between the fields of a record. It can be one or multiple characters. The default value is a comma `,`

### `bigqueryRunner.output.type`

|Type|Default|Enum|
|---|---|---|
|string|"viewer"|"viewer" &#x7C; "output" &#x7C; "file"|

Controls the output destination for query results.

### `bigqueryRunner.output.file.path`

|Type|Default|
|---|---|
|string|"."|

Controls the output file path for query results when output.type is specified as file.


## Recommended Setting

It is recommended to set the settings in settings.json to avoid wrapping when outputting a table with a large number of fields.

```json:settings.json
{
  "[Log]": {
    "editor.wordWrap": "off"
  }
}
```

## Contributing

Feature requests are accepted, but please raise an issue describing your feature before sending a PR. This extension focuses on _querying_ BigQuery, rather than dataset- and/or table- level functionality.

This is not an officially supported Google product.

## License

Apache 2.0 licensed. See the LICENSE file for details.
