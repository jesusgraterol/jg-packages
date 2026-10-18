# Changelog

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `createEnvironmentReader`, which reads environment variables from any record, such as `process.env` or Vite's `import.meta.env`: required and optional strings, allowed values, `true` or `false`, integers in plain decimal digits, and JSON checked by a schema.
- `jg-env/node`'s `createSecretReader`, which reads secrets from files: the file at the path the secret's variable holds inside a container, and `<KEY>.txt` in a secrets directory elsewhere.
- Errors that name the variable and never its value: `ENV_VARIABLE_MISSING`, `ENV_VARIABLE_INVALID`, and `ENV_SECRET_FILE_UNREADABLE`.
