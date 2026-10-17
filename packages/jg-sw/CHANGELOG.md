# Changelog

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `ERRORS.SW_REGISTRATION_FAILED`, the code of a registration the browser rejects, with the browser's error as `cause`.

### Changed

- `registrationError` in the snapshot is an `Exception` with one of the `ERRORS` codes, instead of an encoded message.
- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release of `jg-sw`, which replaces `sw-service` 1.2.0 and `sw-builder` 1.2.1.

### Added

- `registerServiceWorker`, `getServiceWorkerSnapshot`, `subscribeToServiceWorker`, `updateApp`, `canInstallApp`, and `installApp`, which replace the `SWService` object, with `ERRORS` and the `REGISTRATION_DURATION_SECONDS`, `UPDATE_INSTALL_TIMEOUT_SECONDS`, `DEFAULT_SERVICE_WORKER_PATH`, `DEFAULT_SERVICE_WORKER_SCOPE`, and `SKIP_WAITING_MESSAGE_TYPE` constants.
- A snapshot whose identity changes only with the state, for `useSyncExternalStore`, with `hasWaitingWorker` and the installation state.
- `jg-sw/build`, with `buildServiceWorker`, `writeServiceWorker`, `readServiceWorkerConfig`, `ServiceWorkerConfigSchema`, and `ERRORS`, the codes of every error it throws.
- `serviceWorkerPlugin`, a Vite plugin that writes the worker after a build and serves it without caching in development.
- The `jg-sw` CLI, with `--config`, `--environment`, `--no-caching`, and `--help`.
- The worker activates when the page posts the skip-waiting message.
- `caching: false` and `--no-caching`, which generate a worker without precaching, cache cleanup, or a fetch handler.
- The `INVALID_FIREBASE_SDK_VERSION` code.

### Changed

- `updateApp()` activates the waiting worker and reloads once it controls the page. Without one, it waits up to 30 seconds for a new worker to install, and reloads as it is when none installs.
- `registerServiceWorker()` resolves once the registration settles, never rejects, and returns the first call's promise on later calls.
- `installApp()` resolves to the prompt's outcome.
- The install prompt is tracked from the first `registerServiceWorker()` call, before the registration settles.
- Logs appear only with `debugMode`, and nothing touches `window` or `navigator` when the module loads.
- The worker never caches responses marked `Cache-Control: no-store` or `private`.
- The config file is named `jg-sw.config.json`, and the Firebase background hook `self.jgSwFcmBackgroundMessageHandler`.
- `firebaseSdkVersion` must be a version such as `12.4.0`. An invalid template fails with `INVALID_TEMPLATE_NAME`, and an unsupported environment with `INVALID_ENVIRONMENT`, whatever the template.
- Environment files load with Node.js's `process.loadEnvFile`.
- Precached paths are URL paths from `outDir`, with `#`, `?`, and `%` percent-encoded and each directory's files sorted. A path outside `outDir` fails with `NOT_A_PATH_ELEMENT`.
- Values written into the worker are serialized as JSON.
- Errors are `Exception`s from `jg-exception`.

### Removed

- The `SWService` object and its `ISWService`, `IAppInstallerService`, and `ISWRegistrationOptions` types.
- Running the CLI on import, and the `dotenv` and `argv-utils` dependencies.
