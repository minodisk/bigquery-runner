# Change Log

All notable changes to the "bigquery-runner" extension will be documented in this file.

## [v0.0.19]

### Added

- Validate that the query is correct when editing it.
- Convert the relative path set in keyFilename to an absolute path from the root folder.

### Changed

- Changed to validate queries by default.
- Renamed verifyOnSave option to queryValidation.

## [v0.0.18]

### Changed

- Changed the message to correctly state that the amount of data to be read by dry run has been estimated.

## [v0.0.17]

### Added

- Added JSON format
- Added JSON Lines format

### Changed

- Renamed validateOnSave option to verifyOnSave

### Removed

- Removed support for json space

## [v0.0.16]

### Added

- Added markdown table format.

## [v0.0.15]

### Changed

- Rename option `checkErrorOnSave` to `validateOnSave`.
- Changed to put a new line in the Output Channel for each execution.

## [v0.0.14]

### Changed

- Changed screenshot for `checkErrorOnSave` option in README.

## [v0.0.13]

### Added

- Added option to check for query errors when saving files.

### Changed

- Changed to add units to bytes output in logs.

## [v0.0.12]

### Added

- Mark the location of errors encountered during the execution of a query job in the editor.

## [v0.0.11]

### Changed

- Added a new line to the last line of output.

## [v0.0.10]

### Changed

- Show output window when outputting error log.

## [v0.0.9]

### Added

- Added file export as an option.
- Added header and delimiter options to CSV format.
- Added space option to JSON format.

### Changed

- Changed the format of the option settings.
- Changed CSV format to express deep structure.

### Removed

- Removed JSON pretty option.

## [v0.0.8]

### Added

- Add a screenshot to the README.
- Add the recommended settings to the README.

## [v0.0.7]

### Added

- Runs the selected text as query, if the text is selected.

### Removed

- Removed the command dedicated to the selected text.

## [v0.0.6]

### Bug

- Capture errors that were not captured and printed in the output window.

## [v0.0.5]

### Changed

- Unify the signature of the extension with bigqueryRunner.

## [v0.0.4]

### Changed

- Update repository URL.

## [v0.0.3]

### Added

- Add option to preserve focus.
- Enabled table format to represent deep structures.
- Add an icon.

### Changed

- Print error to output window.

## [v0.0.2]

### Changed

- Don't focus to the output window on every output.
