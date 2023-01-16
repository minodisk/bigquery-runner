# Change Log

All notable changes to the "BigQuery Runner" extension will be documented in this file.


## v2.0.0

### Changed

- Allow #include directives and to include libraries.
## v1.21.1

### Changed

- Don't display `Query` and `QueryWithPosition` error.
  - Feedback to the editor, so it shouldn't be necessary.
- Don't mark error when text doesn't exist.

## v1.21.0

### Added

- Use built-in icons in the tree view.

![built-in icons in the tree view](https://user-images.githubusercontent.com/514164/200320258-34831094-ac6a-4765-8623-806d92cc46e5.png)

### Changed

- Fix bug that JS could not be loaded from viewer HTML.
  - [#36](https://github.com/minodisk/bigquery-runner/issues/36)

## v1.20.0

### Added

- Feedback on success or failure of login or logout to the view
  - [#35](https://github.com/minodisk/bigquery-runner/issues/35)

![login feedback](https://user-images.githubusercontent.com/514164/197105230-6d321f37-29e9-4ae8-b14f-606cf7982e67.png)

## v1.19.0

### Added

- Add Login/Logout commands.
  - [#33](https://github.com/minodisk/bigquery-runner/issues/33)

### Changed

- Fixed wrong field name.
  - [#34](https://github.com/minodisk/bigquery-runner/issues/34)

## v1.18.0

### Changed

- Do not use cache of previous input values if query parameters are changed.
- Changed the query tokenizer from the original implementation to [sql-formatter](https://github.com/sql-formatter-org/sql-formatter).

## v1.17.0

### Added

- Added icons to the tree view.

![Icons in the tree view](https://user-images.githubusercontent.com/514164/196463784-f4126833-dc56-4d27-9596-caae3a502adf.png)

## v1.16.0

### Added

- Support deep schema with `ARRAY` and `STRUCT` in the tree view.

![Deep schema in the tree view](https://user-images.githubusercontent.com/514164/196380223-42ebbd5b-5c15-49b6-836b-1c094e0fb49f.png)

## v1.15.0

### Added

- Delay the display of the result view until the results are returned successfully.
- Persist query parameters.
- Add commands:
  - `bigqueryRunner.clearParams`: Clear the stored parameters for active text editor.
  - `bigqueryRunner.clearAllParams`: Clear all stored parameters.

## v1.14.0

### Added

- Added some setup guidance.
  - [#32](https://github.com/minodisk/bigquery-runner/issues/32)

## v1.13.0

### Added

- When a table in the tree view of resources is opened, the fields are now displayed.
  - The name and type are displayed in the field.
- Right-clicking on a table in the tree view of resources now displays a context menu of preview commands.

![Fields in resources view](https://user-images.githubusercontent.com/514164/192826579-fe9127fe-4563-47a5-80a8-3b49219bd947.png)

## v1.12.4

### Changed

- Changed to dry-run first when running.
  - This is because there are errors that can only be obtained by dry-run, especially for long queries.
- Changed to correctly display the page in the viewer footer if the result does not exist.
  - Display `0 - 0 of 0` instead of `1 - 0 of 0`.

## v1.12.3

### Changed

- Fixed problem of incorrectly parsing `@` and `?` in strings to query parameters. [#29](https://github.com/minodisk/bigquery-runner/issues/29)

## v1.12.2

### Added

- Added an explanation of how to authenticate using Gcloud Credential to the chapter on authentication methods in the README.

## v1.12.1

### Changed

- Fixed problem with billing status spinner not stopping in some cases.

## v1.12.0

### Added

- Display child jobs' result.
  ![Multiple table pane](https://user-images.githubusercontent.com/514164/182406285-43b20d92-7dde-47a5-8517-82c839f8b7f2.gif)
- Added tree view of resources.
  ![Tree view](https://user-images.githubusercontent.com/514164/182406887-c8a62194-637c-4747-98d7-616e8cfa04e9.png)

### Changed

- Changed schema table direction from horizontal to vertical.
  ![Schema table](https://user-images.githubusercontent.com/514164/182407441-847bf26f-38fa-452d-b5a6-d72608c9e69f.png)
- Schema tabs eliminated and merged into table tabs.

## v1.11.0

### Added

- Added implementation to allow specifying a byte string for `maximumBytesBilled`.

### Changed

- Fixed an problem where the following two settings were not reflected.
  - `useLegacySQL`
  - `maximumBytesBilled`

## v1.10.1

### Changed

- Fixed problem of multiple columns with the same name [#26](https://github.com/minodisk/bigquery-runner/issues/26)
- Fixed problem that tab position would not be retained when moving tab with commands.

## v1.10.0

### Added

- Added features to improve download UX.
  ![bigquery-runner-1658367386809](https://user-images.githubusercontent.com/514164/180110913-e1ba6e85-677c-4d47-8d23-e27ac4e5c430.gif)
  - Display progress bar during downloading. [#19](https://github.com/minodisk/bigquery-runner/issues/19)
  - Display a message to open the file, when the download is complete. [#25](https://github.com/minodisk/bigquery-runner/issues/25)
- Provide commands to move between tabs [#18](https://github.com/minodisk/bigquery-runner/issues/18)
  ![bigquery-runner-1658404913091](https://user-images.githubusercontent.com/514164/180209107-73d78dc9-a498-4e7e-9f99-248e9cdba77e.gif)

### Changed

- Fixed the problem that the spinner in the viewer does not stop when NoPageTokenError occurs when paging.
- Fixed the problem that the current page exceeding range when performing quick paging.

## v1.9.0

### Changed

- Fixed bugs around query parameters.
  - Stop asking to commented out query parameters [#22](https://github.com/minodisk/bigquery-runner/issues/22)
  - Ask the same named parameter only once [#23](https://github.com/minodisk/bigquery-runner/issues/23)
  - Formally support query parameter functions.

## v1.8.0

### Added

- Support default dataset
  ![image](https://user-images.githubusercontent.com/514164/179751508-d5997f84-e1be-40a2-9b44-e8ef0a39136d.png)

## v1.7.0

### Added

- Display download progress, errors and completion in the status bar.

### Changed

- Fixed a problem in which the number of rows that should be retrieved was not displayed or downloaded when retrieving results with a large amount of data per row.
  - The row information displayed on the page is now correct accordingly.

## v1.6.0

### Added

- Added a tab for table schema.
  ![image](https://user-images.githubusercontent.com/514164/178914359-5d3c547d-dedb-40a0-a87e-8eabc7e2695f.png)
- More queries supported.
  - Changed the implementation of data fetching as follows; instead of assuming that it is unlikely to be able to fetch the data necessary for the tab to be displayed and not fetching it, if it is not possible to display the tab as a result of fetching it, it is not displayed.
- Added commands for download.
  ![image](https://user-images.githubusercontent.com/514164/178990174-32e7f5c6-2826-4211-abf4-327ecd9d2714.png)

### Changed

- Reduced the time it takes to change pages.
  - Avoided fetching extraneous data.

## v1.5.0

### Added

- Display type and mode tooltips, when moused over in the column header.
  ![image](https://user-images.githubusercontent.com/514164/178778903-8b390e6a-399c-4a31-951d-3a1142311c39.png)

## v1.4.0

### Added

- Added support for setting Array/Struct/Timestamp as parameters.
  ![bigquery-runner-1657536115053](https://user-images.githubusercontent.com/514164/178248203-a24126dc-4ade-4e6f-93ae-200702edfa51.gif)

## v1.3.0

### Added

- Added the feature to display query errors in the viewer.
  ![bigquery-runner-1657465278847](https://user-images.githubusercontent.com/514164/178150411-0ccf2ae1-a92f-4718-85a9-ad7981b3223b.gif)

## v1.2.0

### Added

- Added the feature to allow quick fixes for query errors.
  ![bigquery-runner-1657414563419](https://user-images.githubusercontent.com/514164/178132836-7dffb6bd-b840-4e2b-8879-e3d6106e510b.gif)

## v1.1.1

### Changed

- Fixed problem with downloading files in Windows.

## v1.1.0

### Added

- Added parameter support experimentally.
  - **This feature could be removed in the future.**
  - References:
    - [Named parameters](https://cloud.google.com/bigquery/docs/samples/bigquery-query-params-named)
    - [Positional parameters](https://cloud.google.com/bigquery/docs/samples/bigquery-query-params-positional)

## v1.0.0

### Added

- Added a download button to the bottom right corner of the Results tab in the viewer.
  - Click it and select the save format and destination to save the results to a file.
- Added a preview button next to the table ID in the viewer.
  - Click it, another viewer will open and display the results of SELECTing that table.
- Added config:
  - `bigqueryRunner.downloader.rowsPerPage`
    - The number of rows to fetch per page of paging when downloading.

### Changed

- Rename config:
  - `queryValidation.enabled` -> `validation.enabled`
  - `queryValidation.debounceInterval` -> `validation.debounceInterval`
  - `bigqueryRunner.format.csv.header` -> `bigqueryRunner.downloader.csv.header`
  - `bigqueryRunner.format.csv.delimiter` -> `bigqueryRunner.downloader.csv.delimiter`
  - `bigqueryRunner.pagination.results` -> `bigqueryRunner.viewer.rowsPerPage`
  - `bigqueryRunner.output.viewer.column` -> `bigqueryRunner.viewer.column`
- Detailed log output to output panel.
- Viewer tabs are now rendered sequentially as data becomes available.
- Fixed a problem that results were not displayed when DECLARE.
  - [#14](https://github.com/minodisk/bigquery-runner/issues/14)

### Removed

- Removed config:
  - `bigqueryRunner.output.type`
    - Removed option to output results to output panel
      - Instead, you can see the results in a nice table that is output to the viewer.
  - `bigqueryRunner.output.file.path`
    - Removed option to output results to file
      - Instead, when you select an output format from the Download button in the Viewer, a dialog box will appear asking you to specify the path where you want to save the file. Once the path is specified in that dialog, output to a file will begin.

## v0.0.53

### Added

- Support routine.

### Changed

- Wait for the HTML to finish loading in the Webview and for the JavaScript to complete initialization.

## v0.0.52

### Changed

- Fixed a problem where results are not displayed in the viewer after a query is executed.

## v0.0.51

### Changed

- Fixed problem with validation on files that are not query files.

## v0.0.50

### Changed

- Fixed a problem with incorrect error mark positions.

## v0.0.49

### Changed

- Fixed the problem of the header and footer showing through when scrolling a horizontal table.

## v0.0.48

### Added

- Notify when text has been copied to the clipboard.

## v0.0.47

### Added

- Added a pane of job information to the viewer.
- Added a pane of table information to the viewer.

## v0.0.46

### Added

- Support multi-select.

## v0.0.45

### Added

- Added GUI buttons to the viewer for paging.
- Added job information pane to the viewer.

### Changed

- Fixed file output directories are automatically created.

## v0.0.44

### Added

- Added a GUI button to run the query on the editor title menu bar.
- Supported `MERGE` statement.
  - Added process to display all records as results after creating the table.

## v0.0.43

### Added

- Open one viewer per query file. Now open as many viewers as the number of queries.
- The position of the column to open the viewer can be set as relative or absolute value: `bigqueryRunner.output.viewer.column`.
- Run / Prev Page / Next Page commands can be executed on the viewer.

## v0.0.42

### Added

- Display the icon on the tab of the webview panel.

## v0.0.41

### Added

- Supported [Query Drive data](https://cloud.google.com/bigquery/external-data-drive).

## v0.0.40

### Changed

- Fixed error when expanding nullable structs.

## v0.0.39

### Changed

- Fixed to mark the position of errors correctly when executing selected text as a query.

## v0.0.38

### Changed

- Upgraded dependent packages

## v0.0.37

### Changed

- Fixed syntax error if data source name contains hyphens.

## v0.0.36

### Added

- Supported `CREATE TABLE AS SELECT` statement.
  - Added process to display all records as results after creating the table.

## v0.0.35

### Changed

- Fixed a bug where the loading display would not stop even though it was in error.

## v0.0.34

### Changed

- Fixed a bug that panel is created on every run.

## v0.0.33

### Changed

- Fixed an irreproducible bug that could cause the viewer instance of the output destination to be disposed during processing.

## v0.0.32

### Changed

- Fixed the bug that boolean is not correctly output to CSV.

## v0.0.31

### Changed

- Fixed a bug where undefined was displayed in empty cells when output.type is set to viewer.
- Added extension setting to README to automatic validation.

## v0.0.30

### Changed

- Fixed a bug that certain types cannot be rendered when output.type is set to viewer.
  - `BIGNUMERIC`
  - `NUMERIC`
  - `BOOL`
  - `BYTES`

## v0.0.29

### Added

- Enabling the setting of status bar items position.
  - `bigqueryRunner.statusBarItem.align`: The alignment of the status bar item
  - `bigqueryRunner.statusBarItem.priority`: The priority of status bar item. Higher value means the item should be shown more to the left.

### Changed

- Display the previous status in the status bar even while loading.

## v0.0.28

### Added

- Display the amount of data to be processed or billed in the status bar.

## v0.0.27

### Changed

- Styled the padding around the table.
- Renamed the value of settings `bigqueryRunner.output.type` from `output` to `log`.
- Update descriptions for commands and configurations.

## v0.0.26

### Added

- Display the skeleton from the initialization of the viewer until the data loading and rendering is complete.
- Added links to each version in the change log.

### Changed

- Rewroted the README.

## v0.0.25

### Added

- Added a spinner to show the loading status.

### Changed

- Optimized data messaging for fast rendering.
- Changed the rendering engine to use React v18β for asynchronous rendering.
- Changed the table header to stick to the top of the panel.
- Changed the table footer to stick to the bottom of the panel.

## v0.0.24

### Added

- Added pagination.
- Added an option for pagination.
  - `bigqueryRunner.pagination.results`: number of rows per page
- Added commands for pagination
  - `bigqueryRunner.prevPage`: display previous page
  - `bigqueryRunner.nextPage`: display next page
- Added a row number column to the viewer.
- Added page information to viewer.

## v0.0.23

### Added

- Show an authentication error message.

## v0.0.22

### Changed

- Fixed issue where viewer resources could not be loaded.

## v0.0.21

### Added

- Add the `viewer` options to `bigqueryRunner.output.type`
  - Rendering a well-formed table to a webview

## v0.0.20

### Added

- Validate already opened files when the extension is activated.

## v0.0.19

### Added

- Validate that the query is correct when editing it.
- Added support for relative paths in `keyFilename` option.
  - Convert the relative path to an absolute path from the root folder.

### Changed

- Changed to validate queries by default.
- Renamed verifyOnSave option to queryValidation.
- Shortened the property in config.
  - `bigqueryRunner.output.format` -> `bigqueryRunner.format`
  - `bigqueryRunner.output.destination` -> `bigqueryRunner.output`

## v0.0.18

### Changed

- Changed the message to correctly state that the amount of data to be read by dry run has been estimated.

## v0.0.17

### Added

- Added JSON format
- Added JSON Lines format

### Changed

- Renamed validateOnSave option to verifyOnSave

### Removed

- Removed support for json space

## v0.0.16

### Added

- Added markdown table format.

## v0.0.15

### Changed

- Rename option `checkErrorOnSave` to `validateOnSave`.
- Changed to put a new line in the Output Channel for each execution.

## v0.0.14

### Changed

- Changed screenshot for `checkErrorOnSave` option in README.

## v0.0.13

### Added

- Added option to check for query errors when saving files.

### Changed

- Changed to add units to bytes output in logs.

## v0.0.12

### Added

- Mark the location of errors encountered during the execution of a query job in the editor.

## v0.0.11

### Changed

- Added a new line to the last line of output.

## v0.0.10

### Changed

- Show output window when outputting error log.

## v0.0.9

### Added

- Added file export as an option.
- Added header and delimiter options to CSV format.
- Added space option to JSON format.

### Changed

- Changed the format of the option settings.
- Changed CSV format to express deep structure.

### Removed

- Removed JSON pretty option.

## v0.0.8

### Added

- Add a screenshot to the README.
- Add the recommended settings to the README.

## v0.0.7

### Added

- Runs the selected text as query, if the text is selected.

### Removed

- Removed the command dedicated to the selected text.

## v0.0.6

### Bug

- Capture errors that were not captured and printed in the output window.

## v0.0.5

### Changed

- Unify the signature of the extension with bigqueryRunner.

## v0.0.4

### Changed

- Update repository URL.

## v0.0.3

### Added

- Add option to preserve focus.
- Enabled table format to represent deep structures.
- Add an icon.

### Changed

- Print error to output window.

## v0.0.2

### Changed

- Don't focus to the output window on every output.
