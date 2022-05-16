# Change Log

All notable changes to the "BigQuery Runner" extension will be documented in this file.

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
