# Changelog

## 0.3.1

### Fixed

- `listUntrackedFiles` and `readIndexEntries` throw `GIT_OUTPUT_INVALID` when Git warns while listing, such as about a directory it couldn't open. Git still exits with 0 then, and left the directory's files out of the list.
- The environment leaves out the inherited Git, askpass, and locale variables whatever their case. On Windows, where Git reads `git_dir` as `GIT_DIR`, a variable spelled in another case reached Git. The prompt variables passed in `env` are ignored in any case too.

## 0.3.0

### Added

- `readChangedPaths(cwd, from, { to? })`, `readIndexEntries(cwd, { paths? })`, and `listUntrackedFiles(cwd, { paths? })`, which read `-z` output and refuse a path that isn't valid UTF-8 with `GIT_OUTPUT_INVALID`.
- `readTopLevel(cwd)`, the working tree's root, or null inside `.git` or a bare repository; `readConfigBoolean(cwd, key, defaultValue)`, a boolean config value in any form Git accepts; and `readGitVersion(cwd)`, which also reads Git for Windows' and Apple's versions.
- `GIT_REPOSITORY_NOT_FOUND` and `GIT_ACCESS_DENIED`, classified from a failed command's stderr, and `assertGitSucceeded(result, subcommand)`, which throws them, or `GIT_COMMAND_FAILED`, for a `runGit` result.
- `runGit({ encoding: 'buffer' })`, the output as bytes.
- `IGitStatus`, `IIndexEntry`, `IGitVersion`, `IReadChangedPathsOptions`, and `IListPathsOptions`.

### Changed

- Every command allows no transport, with an empty `GIT_ALLOW_PROTOCOL`, so reading a partial clone never fetches a missing object, on any Git version and whatever the repository's config allows. `readRemoteRefs` and `fetchCommit` allow HTTPS and SSH by default; `env` can allow others, such as `file`.
- Every command runs in the C locale, without colors, and without recursing into submodules. `isolateConfig` also ignores the system attributes file and `core.attributesFile`.
- `readStatus` reads `git status --porcelain=v2` and resolves to `{ commit, entries }`, every untracked file listed on its own, submodules left out, and conflicts with their status letters.
- `resolveCommit` resolves to null for a revision that names no commit, and `readFileAtRevision` to null for a path its revision has no file at.
- A failed command throws `GIT_REPOSITORY_NOT_FOUND` or `GIT_ACCESS_DENIED` where it used to throw `GIT_COMMAND_FAILED`.
- On Windows, a working directory of 260 characters or more that can't start Git throws `GIT_INVALID_ARGUMENT` instead of `GIT_NOT_FOUND`.

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
