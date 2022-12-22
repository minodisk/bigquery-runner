# Contributing Guide

First, this VSCode extension is responsible for the following as it relates to BigQuery:

- Dry-run the query
- Run the query
- Feedback errors to the editor
- Display the results of the query
- Limited static analysis of queries
  - For finding query parameters

And it does not do the following:

- Syntax highlighting
- Static analysis of queries
  - For other than finding query parameters

## Issues

### Bugs

When reporting a bug, please provide the smallest query that can reproduce the bug.

### Features

New features and feature improvements should be proposed in an issue first. This may solve the problem faster than making a Pull Request without doing so.

## Pull Request

If you send a Pull Request, please test and debug it.

### Install packages

First, please install the dependent packages:

```
npm install
```

### Test

Unit test:

```
npm test
```

Compiler/Formatter check:

```
npm run check
```

Lint:

```
npm run check
```

### Debug

Debug it to check its behavior around the VSCode extension:

1. [Create a service account and its key](https://cloud.google.com/docs/authentication/getting-started) and save it in the project root with the name `service-account.json`.
1. Run `Shell Command: Install 'code' command in PATH` in VSCode command palette.
1. Run `npm run debug` to build BigQuery Runner and install it into VSCode.
1. Run the command `Developer: Reload Window` in VSCode to activate the newly installed BigQuery Runner.
1. Open a query file and run the command `BigQuery Runner: Run` in VSCode.
