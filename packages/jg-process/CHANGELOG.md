# Changelog

## 1.1.1

### Added

- `RECIPES.md`, patterns for apps that use the package: running a CLI with a timeout and an output cap, and stopping a dev server and everything it started. Each block is typechecked against the release.

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release.

### Added

- `runProcess`, which runs a command without a shell, with timeouts, output limits, and abort signals.
- `startProcess(command)`, which takes the command, its arguments, and its options in one `IStartProcessCommand` object, and `stopProcessTree`.
- `ERRORS`, the codes of every error the package throws.
