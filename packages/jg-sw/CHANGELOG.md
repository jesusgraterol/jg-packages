# Changelog

## 1.0.0

The first release of `jg-sw`, which replaces `sw-builder` 1.2.1.

### Added

- `jg-sw/build`, with `buildServiceWorker`, `writeServiceWorker`, `readServiceWorkerConfig`, `ServiceWorkerConfigSchema`, and `ERRORS`, the codes of every error it throws.
- `serviceWorkerPlugin`, a Vite plugin that writes the worker after a build and serves it without caching in development.
- The `jg-sw` CLI, with `--config`, `--environment`, `--no-caching`, and `--help`.
- The worker activates when the page posts the skip-waiting message.
- `caching: false` and `--no-caching`, which generate a worker without precaching, cache cleanup, or a fetch handler.
- The `INVALID_FIREBASE_SDK_VERSION` code.

### Changed

- The worker never caches responses marked `Cache-Control: no-store` or `private`.
- The config file is named `jg-sw.config.json`, and the Firebase background hook `self.jgSwFcmBackgroundMessageHandler`.
- `firebaseSdkVersion` must be a version such as `12.4.0`. An invalid template fails with `INVALID_TEMPLATE_NAME`, and an unsupported environment with `INVALID_ENVIRONMENT`, whatever the template.
- Environment files load with Node.js's `process.loadEnvFile`.
- Precached paths are URL paths from `outDir`, with `#`, `?`, and `%` percent-encoded and each directory's files sorted. A path outside `outDir` fails with `NOT_A_PATH_ELEMENT`.
- Values written into the worker are serialized as JSON.
- Errors are `Exception`s from `jg-exception`.

### Removed

- Running the CLI on import, and the `dotenv` and `argv-utils` dependencies.
