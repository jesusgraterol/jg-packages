# Changelog

## 1.6.1

### Fixed

- The Vite plugin writes `sw.js` only after `vite build`. Closing a dev server or a Vitest run, which close every environment's bundle too, wrote a worker over an existing `dist/sw.js`.

## 1.6.0

### Changed

- The Vite plugin supports Vite 7 as well as 8: the optional `vite` peer range is `^7.0.0 || ^8.0.0`.
- A worker generated with `caching: false`, as the plugin's dev server and `--no-caching` generate it, names its cache `<cacheNamePrefix>--development` instead of a random name, so the development worker is the same on every request and the browser doesn't install it again on each reload.

## 1.5.0

### Changed

- A missing config file's error, `FAILED_TO_READ_BASE_CONFIG`, has `jg-fs` 1.5.0's `NON_EXISTENT_FILE` as its cause, "The file '…' does not exist.", where the cause was `NOT_A_FILE`, and the CLI prints Node.js's `ENOENT` error after it, as that error's own cause.
- Supports Node.js 22.17.0 and later, down from 24.

## 1.4.0

### Added

- `isIosBrowserTab()`, true when the page runs in a browser tab on an iPhone, an iPad, including one that asks for desktop sites, or an iPod touch, rather than as an app installed to the Home Screen, so an app can decide when to show Add to Home Screen instructions.

### Changed

- `installation.isRunningInstalledApp` is also true in Safari's Home Screen app, which reports `navigator.standalone` without a standalone display mode.

## 1.3.0

### Added

- `preloadErrorDetected` in the snapshot. `registerServiceWorker()` listens for Vite's `vite:preloadError`, and when a chunk fails to load while the browser is online and the page has the build's entry module, a `script[type="module"][src]`, it prevents the event's default and sets the flag, so the app can offer `updateApp()`. Any other failure, such as one while offline, is left to Vite and the app's own error handling.

## 1.2.0

### Added

- `navigationFallback` in the config: a precached page, such as `/index.html`, that answers a navigation the worker can neither find in its cache nor fetch, so a single-page app's routes, such as `/settings`, open offline. Without it, the worker behaves as before.
- `ERRORS.NAVIGATION_FALLBACK_NOT_PRECACHED`, which the build throws when the fallback isn't one of the precached paths.

## 1.1.1

### Added

- `RECIPES.md`, patterns for apps that use the package: an offline Vite app, and telling people an update is ready. Each block is typechecked against the release.

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `ERRORS.SW_REGISTRATION_FAILED`, the code of a registration the browser rejects, with the browser's error as `cause`.
- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.

### Changed

- `registrationError` in the snapshot is an `Exception` with one of the `ERRORS` codes, instead of an encoded message.
- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release.

### Added

- `registerServiceWorker`, `getServiceWorkerSnapshot`, `subscribeToServiceWorker`, `updateApp`, `canInstallApp`, and `installApp`, with `ERRORS` and the `REGISTRATION_DURATION_SECONDS`, `UPDATE_INSTALL_TIMEOUT_SECONDS`, `DEFAULT_SERVICE_WORKER_PATH`, `DEFAULT_SERVICE_WORKER_SCOPE`, and `SKIP_WAITING_MESSAGE_TYPE` constants.
- A snapshot whose identity changes only with the state, for `useSyncExternalStore`, with `hasWaitingWorker` and the installation state.
- `jg-sw/build`, with `buildServiceWorker`, `writeServiceWorker`, `readServiceWorkerConfig`, `ServiceWorkerConfigSchema`, and `ERRORS`, the codes of every error it throws.
- `serviceWorkerPlugin`, a Vite plugin that writes the worker after a build and serves it without caching in development.
- The `jg-sw` CLI, with `--config`, `--environment`, `--no-caching`, and `--help`.
- A generated worker that activates when the page posts the skip-waiting message, never caches responses marked `Cache-Control: no-store` or `private`, and can be generated without caching for development.
