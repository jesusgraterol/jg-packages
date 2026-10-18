# jg-sw recipes

Patterns for Vite apps that keep working offline, and tell people when a new version is ready.

## An offline Vite app

Use this when the app should open without a network after the first visit. The plugin writes `sw.js` into the build after Vite's own files, and the worker caches the files you list when it installs. Putting the config in `vite.config.ts` gets it typechecked with the rest of the file:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from 'jg-sw/build';

export default defineConfig({
  plugins: [
    serviceWorkerPlugin({
      config: {
        // Vite's build.outDir, where the worker is written too
        outDir: 'dist',
        template: 'base',

        // the namespace of this app's caches, so a new version deletes only its own old ones
        cacheNamePrefix: 'my-app',

        // the page and Vite's hashed bundles, which is all the app needs to start offline
        includeToPrecache: ['/', '/index.html', '/assets'],
        excludeFilesFromPrecache: [],

        // the worker answers from its cache first, so keep API data and other pages out of it
        excludeMIMETypesFromCache: ['application/json', 'text/html'],

        // offline, a route the app handles, such as /settings, opens through the page
        navigationFallback: '/index.html',
      },
    }),
  ],
});
```

The worker answers same-origin `GET` requests from its cache before the network, and caches what it fetches, so whatever it caches stays the same until the next build replaces the cache. That suits hashed bundles, and would serve stale data from an API on the same origin: `excludeMIMETypesFromCache` keeps JSON out, and responses marked `Cache-Control: no-store` or `private` never enter the cache either. Add the files from `public/` that the page loads, such as its icons, to `includeToPrecache` when they should show offline. `config` also takes a path, such as `'jg-sw.config.json'`, when the CLI reads the same file.

Register the worker from the app's entry module. Precaching downloads every listed file, so it starts once the page has loaded:

```ts
// src/main.ts
import { hasErrorCode } from 'jg-exception';
import { ERRORS, registerServiceWorker } from 'jg-sw';

window.addEventListener(
  'load',
  async () => {
    // it never rejects: a failure lands in registrationError
    const { registrationError } = await registerServiceWorker();

    // without service workers the app still runs, online only, so that case needs no report
    if (
      registrationError !== undefined &&
      !hasErrorCode(registrationError, ERRORS.SW_NO_BROWSER_SUPPORT)
    ) {
      console.error(registrationError);
    }
  },
  { once: true },
);
```

During `vite`, the dev server answers `/sw.js` with a worker that caches nothing, so registration works and every request still reaches the dev server. To try the offline app, run `vite build` and `vite preview`, load the page once, then turn the network off in the browser's devtools. The worker matches each request exactly, so a client-side route, such as `/settings`, is never in its cache. Offline, `navigationFallback` answers the navigation with the precached page, at the route's URL, so the app's router shows it; without it, reloading the route gets the worker's network error. The fallback must be one of the precached paths, or the build fails with `NAVIGATION_FALLBACK_NOT_PRECACHED`.

## Telling people an update is ready

Each build makes a new worker, which installs next to the running one and waits, so open pages keep the version they loaded. Use this to tell people a new version is ready and let them choose when to switch, because switching reloads the page. The state comes from `registerServiceWorker`, so call it first, as in the previous recipe:

```ts
import { getServiceWorkerSnapshot, subscribeToServiceWorker, updateApp } from 'jg-sw';

// shows the button only while a new version waits, or a chunk of a replaced build failed to load
const showUpdateState = (): void => {
  const { hasWaitingWorker, preloadErrorDetected } = getServiceWorkerSnapshot();
  updateButton.hidden = !(hasWaitingWorker || preloadErrorDetected);
};
subscribeToServiceWorker(showUpdateState);

// a version may already wait when this runs, such as one installed during an earlier visit
showUpdateState();

updateButton.addEventListener('click', () => {
  // it reloads the page, so it runs only when the person asks
  updateButton.disabled = true;
  void updateApp();
});
```

`updateApp()` asks the waiting worker to take over, and reloads the page a single time when the new worker controls it, never in a loop. Don't call it on your own while a form holds unsaved input. A "Check for updates" item, such as in a settings menu, can call it with no version waiting: it looks for one, waits up to `UPDATE_INSTALL_TIMEOUT_SECONDS` for it to install, and reloads the page either way.

Browsers look for a new worker when a page in its scope loads. A single-page app can stay open for days without loading another page, so look again when the person returns to the tab:

```ts
import { getServiceWorkerSnapshot } from 'jg-sw';

document.addEventListener('visibilitychange', () => {
  const { registration } = getServiceWorkerSnapshot();
  if (document.visibilityState === 'visible' && registration !== undefined) {
    // offline, the check fails, and the next return to the tab tries again
    registration.update().catch(() => undefined);
  }
});
```

When the check finds a new version, the snapshot changes once it has installed, and the button from the previous block appears.

A deployment also replaces the build's chunks, so a page that stayed open on the old version can fail to load one, such as when the person opens a route for the first time. `preloadErrorDetected` turns true then, and the same button loads the new version. jg-sw handles only a failure while online, on a page with the build's entry module; one while offline stays Vite's error, for the app's error handling, because reloading wouldn't help.
