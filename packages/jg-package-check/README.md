# jg-package-check

Inspect npm tarballs and qualify installed package exports in disposable Node.js consumers. Works on Node.js 22.17 or later.

## Install

```sh
npm install --save-dev jg-package-check
```

## Usage

- `inspectNpmTarball` reads a bounded gzip archive and returns a map of package-relative names to their raw file bytes. It checks the npm root, portable paths, unique files and clean termination. The input must be a regular-file npm tarball. Directory and link entries and extended tar metadata are rejected.
- `withPackedConsumer` installs local tarballs in a temporary ESM project with npm or pnpm and disables lifecycle scripts. It removes the project when the checks finish or fail. The optional `prepare` callback can write fixture configuration inside the project.
- `checkPackedExports` looks for unpublished `workspace:` and `catalog:` ranges, imports the named public subpaths and verifies that Node.js refuses the named private subpaths.

Use tarball inspection before installation. Export checks run the installed package's code. Use artifacts from a source you trust and avoid changing them during qualification. The caller defines the allowed archive files and owns CLI, type, application and release checks.

## Errors

| Code                             | Message                                |
| -------------------------------- | -------------------------------------- |
| `INVALID_NPM_TARBALL`            | The npm tarball is invalid.            |
| `PACKED_CONSUMER_SETUP_FAILED`   | Unable to prepare the packed consumer. |
| `PACKED_CONSUMER_CLEANUP_FAILED` | Unable to remove the packed consumer.  |

A cleanup error includes the temporary path in `data.directory`. Its cause preserves an earlier callback or setup failure if both operations failed. A callback error propagates after successful cleanup.

## Documentation

See [API.md](API.md) for the full contracts and [RECIPES.md](RECIPES.md) for examples.

## License

[MIT](LICENSE)
