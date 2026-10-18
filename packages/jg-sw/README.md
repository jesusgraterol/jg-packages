# jg-sw

Service workers for web apps: a generated caching worker with a Vite plugin and CLI, plus registration, updates, and installation.

## Install

```bash
npm install jg-sw
```

## Usage

### Register the worker

```ts
import { registerServiceWorker } from 'jg-sw';

const { registration, registrationError } = await registerServiceWorker(); // registers /sw.js
```

It never rejects: a failure lands in `registrationError`, an `Exception` whose code is one of `ERRORS`. Later calls return the first call's promise, and nothing runs until the first call, so it's safe to import during server-side rendering.

### Offer updates and installation

The snapshot tells you when a new version waits and whether the app can be installed. It keeps its identity until something changes, so React can read it directly:

```tsx
import { useSyncExternalStore } from 'react';
import { getServiceWorkerSnapshot, installApp, subscribeToServiceWorker, updateApp } from 'jg-sw';

export const AppBanner = () => {
  const { hasWaitingWorker, installation } = useSyncExternalStore(
    subscribeToServiceWorker,
    getServiceWorkerSnapshot,
    getServiceWorkerSnapshot,
  );
  return (
    <>
      {hasWaitingWorker && <button onClick={() => void updateApp()}>Update</button>}
      {installation.canInstall && <button onClick={() => void installApp()}>Install</button>}
    </>
  );
};
```

Without React, `subscribeToServiceWorker(listener)` calls the listener on every change and returns a function that stops it.

`updateApp()` reloads the page once, never in a loop:

- When a new version waits, it asks it to activate and reloads once it controls the page.
- Otherwise it checks for one, waits up to `UPDATE_INSTALL_TIMEOUT_SECONDS` (30) for it to install, then activates it the same way.
- When nothing new is found, the installation fails, or the time runs out, it reloads the page as it is.

`installApp()` shows the browser's install prompt and resolves to `'accepted'` or `'dismissed'`. Only Chromium-based browsers offer it, so check `canInstallApp()` or `installation.canInstall` first.

### Describe the worker

Create `jg-sw.config.json` next to your app's `package.json`:

```json
{
  "outDir": "dist",
  "template": "base",
  "cacheNamePrefix": "my-app",
  "includeToPrecache": ["/assets"],
  "excludeFilesFromPrecache": ["some-ignorable-file.woff2"],
  "excludeMIMETypesFromCache": ["application/json", "text/plain", "text/html"]
}
```

| Field                       | What it does                                                                                                                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `outDir`                    | The directory the app's build is written to. The worker is written there as `sw.js`.                                                                                                                                                     |
| `template`                  | `base` caches the app. `firebase-fcm` also shows Firebase Cloud Messaging notifications.                                                                                                                                                 |
| `cacheNamePrefix`           | The namespace of the worker's caches, in lowercase words separated by hyphens, such as `my-app`. Each build caches under `<cacheNamePrefix>--<10 characters>`.                                                                           |
| `includeToPrecache`         | The files and directories, relative to `outDir`, cached when the worker installs. Directories are read recursively, and `/` stands for the app's root page.                                                                              |
| `excludeFilesFromPrecache`  | File names left out of precaching, wherever they are.                                                                                                                                                                                    |
| `excludeMIMETypesFromCache` | MIME types whose responses are never cached.                                                                                                                                                                                             |
| `navigationFallback`        | Optional. A precached page, such as `/index.html`, that answers a navigation the worker can't serve offline, so a single-page app's routes still open. The build fails with `NAVIGATION_FALLBACK_NOT_PRECACHED` when it isn't precached. |

This config precaches the hashed files under `dist/assets`, but not `/` or `index.html`. Nothing is precached unless it's listed: add `/` and `/index.html` to precache the app's shell.

### Generate it with Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from 'jg-sw/build';

export default defineConfig({
  plugins: [serviceWorkerPlugin({ config: 'jg-sw.config.json' })],
});
```

`vite build` writes `dist/sw.js` after the app's files. `vite` serves a worker without caching at `/sw.js`, so you can test registration and updates while every request still reaches the dev server.

### Generate it with the CLI

Run `jg-sw` after your build:

```json
{
  "scripts": {
    "build": "vite build && jg-sw"
  }
}
```

```text
Usage: jg-sw [options]

Options:
  --config <path>        The config file. Defaults to jg-sw.config.json.
  --environment <name>   development, staging, or production.
  --no-caching           Generates a worker without precaching, cache cleanup, or a fetch handler.
  --help                 Prints this message.
```

It prints the path it wrote and exits 0, or prints the error and exits 1.

### Generate it from code

```ts
import { readServiceWorkerConfig, writeServiceWorker } from 'jg-sw/build';

const config = await readServiceWorkerConfig('jg-sw.config.json');
await writeServiceWorker(config, { environment: 'production' }); // '/app/dist/sw.js'
```

`buildServiceWorker` returns the worker's source without writing it.

### What the worker does

- `install` fills only the new version's cache, and doesn't skip waiting, so the previous worker keeps serving its clients.
- The page activates a waiting worker by posting `{ type: 'JG_SW_SKIP_WAITING' }` to it.
- `activate` deletes the older caches in its own namespace, keeps every other cache, then claims its clients.
- It answers same-origin `GET` requests from the current version's cache, then from the network, and caches successful responses unless they're opaque, partial, marked `Vary: *`, marked `Cache-Control: no-store` or `private`, or of an excluded MIME type. A failed cache write never replaces a valid response.
- When a navigation is in neither its cache nor the network's reach, such as offline, it answers with the `navigationFallback` page when one is set, and otherwise with a `408` network error. A `4xx` or `5xx` from the server is passed through as it is.

### Firebase Cloud Messaging

The `firebase-fcm` template adds two fields:

```json
{
  "template": "firebase-fcm",
  "firebaseConfigProcessEnvKey": "VITE_FIREBASE_CONFIG",
  "firebaseSdkVersion": "12.4.0"
}
```

The environment variable holds the Firebase web app's options as JSON:

```bash
VITE_FIREBASE_CONFIG='{"options":{"apiKey":"example-api-key","authDomain":"example.firebaseapp.com","projectId":"example-project","storageBucket":"example.firebasestorage.app","messagingSenderId":"123456789012","appId":"1:123456789012:web:example"}}'
```

Generate the worker with an environment, such as `jg-sw --environment production`. It loads `.env`, `.env.staging`, or `.env.production` when the file exists, and variables already set keep their values.

The worker loads Firebase's compat SDK from `gstatic`. When no app window is visible, it shows a notification for each data-only message, using its `title`, `body`, `icon`, `badge`, and `url` fields, and Firebase shows the messages that carry a notification. Clicking a notification focuses or opens its URL, limited to the app's origin. To decide yourself, append code to the generated worker that assigns `self.jgSwFcmBackgroundMessageHandler = async (payload) => { … }`. The worker waits for it, and shows nothing else.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-sw/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-sw/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-sw/LICENSE)
