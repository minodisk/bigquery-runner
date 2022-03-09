# Contributing Guide

First, this VS Code extension is responsible for the following as it relates to BigQuery:

- Dry-run the query
- Run the query
- Display the results of the query

And it does not do the following:

- Syntax highlighting
- Static analysis of queries

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

Unit test around the core package:

```
npm test
```

### Debug

Debug it to check its behavior around the VS Code extension:

1. Run `npm run debug` to build BigQuery Runner and install it into VS Code.
1. Run the command `Developer: Reload Window` in VS Code to activate the newly installed BigQuery Runner.
1. Open a query file and run the command `BigQuery Runner: Run` in VS Code.
