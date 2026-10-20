# Changelog

## 0.2.0

### Changed

- Supports Node.js 22.17.0 and later, down from 24.

### Fixed

- Git commands with `isolateConfig`, and `fetchCommit`, work on Windows. They pointed Git's global config and hooks path at Node.js's null device, `\\.\nul`, which Git for Windows can't open, so every such command failed; they now use `/dev/null`, which Git reads as its null device on every system.

## 0.1.0

### Added

- `runGit(args, options)`, which runs `git` through jg-process's `runProcess` without a terminal prompt, an askpass program, inherited `GIT_*` variables, a file system monitor, or a pager, and, unless `useCredentialHelpers` is set, without credential helpers. It resolves with any exit code, within a 30-second timeout and a 1 MiB output limit by default. `isolateConfig` ignores the system config and the user's global config.
- `createGitEnvironment(options)`, the environment `runGit` uses, with `DEFAULT_GIT_SSH_COMMAND`, SSH in batch mode.
- Typed helpers that throw `GIT_COMMAND_FAILED` with the subcommand and the exit code, never stderr: `resolveCommit`, `readRemoteRefs`, `getRemoteUrl`, `readStatus`, `isWorkingTreeClean`, `readFileAtRevision`, and `fetchCommit`.
- `calculateGitBlobObjectId(content, { algorithm })`, the object ID `git hash-object` gives, for SHA-1 or SHA-256.
- `GIT_NOT_FOUND`, `GIT_INVALID_ARGUMENT`, and `GIT_OUTPUT_INVALID`.
- Recipes for reading a file at a pinned commit and checking a checkout before a release script.
