# Changelog

## 0.3.0

### Changed

- `readEnvFile` with `requirePrivate` and a `rootPath` that doesn't exist throws `ENV_FILE_UNREADABLE`, where it threw `ENV_FILE_NOT_PRIVATE`, and reads as `{}` with `isOptional`, as a missing file does. A `rootPath` that is a file still throws `ENV_FILE_NOT_PRIVATE`.
- Depends on `jg-fs` 1.5.0, which reports a missing path as `NON_EXISTENT_FILE` or `NON_EXISTENT_DIRECTORY`.

## 0.2.0

### Added

- `jg-env/node`'s `readEnvFile(path, { requirePrivate?, maxBytes?, rootPath?, isOptional? })`, which reads a `.env` file's variables into a record with Node.js's `util.parseEnv`, without changing `process.env`: as UTF-8, at most 65,536 bytes by default, without a byte-order mark. With `requirePrivate`, the file must be private, not reached through a link, and inside `rootPath`; with `isOptional`, a missing file reads as `{}`. It throws `ENV_FILE_UNREADABLE`, `ENV_FILE_NOT_PRIVATE`, `ENV_FILE_TOO_LARGE`, or `ENV_FILE_INVALID`, naming the file and never a value.
- `mergeEnvSources(...sources)`, which merges sources such as a base file, an overlay, and `process.env`, a later one winning and an undefined value skipped.
- `IReadEnvFileOptions` and `IEnvSource`.
- A recipe for a base `.env` with a private overlay.

### Changed

- Depends on `jg-fs`, for the bounded and private file reads, from `jg-env/node` only.

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `createEnvironmentReader`, which reads environment variables from any record, such as `process.env` or Vite's `import.meta.env`: required and optional strings, allowed values, `true` or `false`, integers in plain decimal digits, and JSON checked by a schema.
- `jg-env/node`'s `createSecretReader`, which reads secrets from files: the file at the path the secret's variable holds inside a container, and `<KEY>.txt` in a secrets directory elsewhere.
- Errors that name the variable and never its value: `ENV_VARIABLE_MISSING`, `ENV_VARIABLE_INVALID`, and `ENV_SECRET_FILE_UNREADABLE`.
