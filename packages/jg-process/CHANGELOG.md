# Changelog

## 1.6.0

### Added

- `runProcess({ encoding: 'buffer' })`, which returns `stdout` and `stderr` as the bytes the process wrote, typed as Buffers, for output that may not be valid UTF-8. `IProcessOutputEncoding` and `IProcessOutput`, and `IProcessResult`, which takes the output's type.
- `isProcessRunning(pid)`, whether a process is running, which treats only ESRCH as gone and throws `INVALID_PROCESS_ID` for an id that isn't a positive safe integer.
- `createShutdownSignal({ disconnect: true })`, which shuts down as with SIGTERM when the parent closes the IPC channel, and at once when it's already closed.
- `parseStrictArgs(args, options)`, a strict `util.parseArgs` that also refuses a repeated option that isn't `multiple`, an empty value, and a missing `required` option, with `INVALID_ARGUMENTS` naming the option in `data.option`.
- `readStdin({ maxBytes, signal? })`, which reads stdin to its end, destroying it and rejecting with `STDIN_TOO_LARGE` past the limit, or with the signal's reason.
- `isMainModule(importMetaUrl)`, whether a module is the script Node.js started, comparing real paths.
- `IStrictArgOption`, `IStrictArgValues`, and `IReadStdinOptions`.

### Changed

- `runProcess` rejects with `INVALID_PROCESS_OPTIONS` before starting when the timeout isn't a positive number of at most 2,147,483 seconds, the longest a Node.js timer waits, or the output limit isn't a positive safe integer. A zero output limit used to fail on the first byte.

## 1.5.0

### Changed

- Supports Node.js 22.17.0 and later, down from 24.

## 1.4.0

### Added

- `createShutdownSignal({ signals?, onSignal?, setExitCode?, forceOnRepeat? })`, which turns SIGINT and SIGTERM, `DEFAULT_SHUTDOWN_SIGNALS`, or the signals passed, into an `AbortSignal` that aborts with `PROCESS_INTERRUPTED` at the first one, sets `process.exitCode` to 128 plus its number, 130 or 143, and calls `onSignal` once. It never calls `process.exit`. Later signals are ignored, or, with `forceOnRepeat`, stop the process at once. `dispose()` stops listening, and `receivedSignal()` and `exitCode()` say what arrived. Signals that aren't valid, or SIGKILL and SIGSTOP, throw `INVALID_SIGNAL`.
- `DEFAULT_SHUTDOWN_SIGNALS`, `IShutdownSignal`, and `IShutdownSignalOptions`.

### Changed

- The README and the recipe for stopping a dev server use `createShutdownSignal` instead of `process.once`.

## 1.3.0

### Added

- `resolvePackageManagerCommand(args, { packageManager?, env?, cwd? })`, the command that runs pnpm, npm, yarn, or bun without a shell on Windows, macOS, and Linux: the entry `npm_execpath` names, the project's own install, or PATH, running a JavaScript entry through the current Node.js and never spawning a Windows `.cmd` file. It throws `UNSUPPORTED_PACKAGE_MANAGER` or `PACKAGE_MANAGER_NOT_FOUND`.
- `waitForPort(port, options)` and `waitForUrl(url, options)`, which probe until a port accepts connections or a URL answers, by default with a 2xx status and without following redirects, and reject with `PROCESS_NOT_READY` at the deadline, or with `PROCESS_EXITED_BEFORE_READY` or `PROCESS_START_FAILED` when a watched `child` can no longer become ready.
- `startProcessAndWait(command, { readyWhen, timeoutSeconds, ... })`, which starts a process and resolves with it once its port, URL, or probe says it's ready, and otherwise stops its whole process tree before rejecting. Invalid options throw `INVALID_READINESS_OPTIONS` or `INVALID_PORT`.
- `IPackageManager`, `IPackageManagerCommand`, `IResolvePackageManagerOptions`, `IReadinessWaitOptions`, `IReadyWhen`, `IWaitForPortOptions`, `IWaitForUrlOptions`, and `IStartProcessAndWaitOptions`.
- A recipe for running a package script from your own script.

### Changed

- Depends on `jg-utilities` 1.4.0, for its `waitUntil`.
- The recipe for starting a dev server on a free port waits until the server answers, with `startProcessAndWait`.

## 1.2.0

### Added

- `reservePort({ preferredPort?, host? })`, which reserves a free TCP port by listening on it until it's released: the preferred port when it's free, any free port when it's taken. It closes every connection to the port, and doesn't keep the process running. A preferred port that isn't an integer from 1 to 65535 throws `INVALID_PORT`, and a listen failure other than a taken port throws `PORT_RESERVATION_FAILED`.
- `IReservePortOptions` and `IPortReservation`.
- A recipe for starting a dev server on a free port.

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
