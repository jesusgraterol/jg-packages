/* ************************************************************************************************
 *                                             CACHE                                              *
 ************************************************************************************************ */

/**------------------------------------------------------------------------------------------------
 * Constants, set by jg-sw when it generates the worker
 -------------------------------------------------------------------------------------------------*/

// the application-owned prefix shared by all versions of this worker
const CACHE_NAME_PREFIX = '';

// the unambiguous namespace used to identify caches owned by this application
const CACHE_NAMESPACE = CACHE_NAME_PREFIX + '--';

// the current version-specific cache name
const CACHE_NAME = '';

// assets that will be cached once the service worker is installed
const PRECACHE_ASSETS = [];

// the list of MIME Types that won't be cached when the app sends HTTP GET requests
const EXCLUDE_MIME_TYPES = [];

// the Cache-Control directives that keep a response out of the cache
const UNCACHEABLE_CACHE_CONTROL_DIRECTIVES = ['no-store', 'private'];

// the type of the message the page posts to make this worker activate while it's waiting
const SKIP_WAITING_MESSAGE_TYPE = '';

// false in development: the worker then precaches nothing, keeps older caches, and handles no
// fetch events, so every request reaches the network
const CACHING = true;

/**------------------------------------------------------------------------------------------------
 * Main actions
 -------------------------------------------------------------------------------------------------*/

/**
 * Invoked when the Service Worker has been installed. It takes care of adding the base resources
 * to the cache (if any).
 * @returns A promise that resolves when the resources have been added to the cache
 */
const precacheResources = async () => {
  if (PRECACHE_ASSETS.length > 0) {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_ASSETS);
  }
};

/**
 * Verifies that a request is eligible for interception by this Service Worker.
 * @param {*} request
 * @returns A boolean indicating if the request should be handled
 */
const shouldHandleRequest = (request) =>
  request.method === 'GET' && new URL(request.url).origin === self.location.origin;

/**
 * Verifies if the value of the 'Accept' or 'Content-Type' header is cacheable.
 * @param {*} contentTypeHeader
 * @returns A boolean indicating if the value of the header is cacheable
 */
const isMIMETypeCacheable = (contentTypeHeader) =>
  contentTypeHeader === null ||
  !EXCLUDE_MIME_TYPES.some((type) => contentTypeHeader.includes(type));

/**
 * Verifies that a response does not vary on every request header.
 * @param {*} varyHeader
 * @returns A boolean indicating if the value of the header is cacheable
 */
const isVaryHeaderCacheable = (varyHeader) =>
  varyHeader === null || !varyHeader.split(',').some((field) => field.trim() === '*');

/**
 * Verifies that a response's Cache-Control header allows a shared cache to store it: neither
 * no-store nor private, with or without a value such as private="Set-Cookie".
 * @param {*} cacheControlHeader
 * @returns A boolean indicating if the value of the header is cacheable
 */
const isCacheControlCacheable = (cacheControlHeader) =>
  cacheControlHeader === null ||
  !cacheControlHeader
    .split(',')
    .some((directive) =>
      UNCACHEABLE_CACHE_CONTROL_DIRECTIVES.includes(directive.split('=')[0].trim().toLowerCase()),
    );

/**
 * All successful responses should be cached except for:
 * - Non-GET requests
 * - Opaque responses
 * - Partial Content responses
 * - Responses that include a Vary: * header
 * - Responses whose Cache-Control includes no-store or private
 * - Requests or responses with MIME Types included in EXCLUDE_MIME_TYPES
 * @param {*} request
 * @param {*} response
 * @returns A boolean indicating if the request can be cached
 */
const canRequestBeCached = (request, response) =>
  response.ok &&
  response.status !== 206 &&
  request.method === 'GET' &&
  response.type !== 'opaque' &&
  isVaryHeaderCacheable(response.headers.get('vary')) &&
  isCacheControlCacheable(response.headers.get('cache-control')) &&
  isMIMETypeCacheable(request.headers.get('accept')) &&
  isMIMETypeCacheable(response.headers.get('content-type'));

/**
 * Adds the request and its response to the cache.
 * @param {*} request
 * @param {*} response
 * @returns A promise that resolves when the request and its response have been added to the cache
 */
const putInCache = async (request, response) => {
  if (canRequestBeCached(request, response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
  }
};

/**
 * Attempts to cache a response without rejecting the fetch lifecycle on storage failures.
 * @param {*} request
 * @param {*} response
 * @returns A promise that resolves after the cache write has completed or failed
 */
const putInCacheSafely = async (request, response) => {
  try {
    await putInCache(request, response);
  } catch (error) {
    // cache writes are best-effort and must not replace a valid network response
    console.error('Failed to cache the network response.', error);
  }
};

/**
 * Intercepts the fetch requests and attempts to fill them with data from the cache. If not present,
 * it will perform the request and store the data in cache.
 * Note: the Response stored in cache is a clone as it can only be read once.
 * @param {*} request
 * @param {*} event
 * @returns A promise that resolves to a Response object
 */
const cacheFirst = async (request, event) => {
  // first, try to get the resource from the current version's cache
  const cache = await caches.open(CACHE_NAME);
  const responseFromCache = await cache.match(request);
  if (responseFromCache) {
    return responseFromCache;
  }

  // next, try to get the resource from the network
  let responseFromNetwork;
  try {
    responseFromNetwork = await fetch(request);
  } catch {
    return new Response('Network error happened', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  event.waitUntil(putInCacheSafely(request, responseFromNetwork.clone()));
  return responseFromNetwork;
};

/**------------------------------------------------------------------------------------------------
 * Clean up actions
 -------------------------------------------------------------------------------------------------*/

/**
 * Deletes older caches owned by the configured application namespace.
 * @returns A promise that resolves when the old application caches have been deleted
 */
const deleteOldCaches = async () => {
  const keyList = await caches.keys();
  const cachesToDelete = keyList.filter(
    (key) => key.startsWith(CACHE_NAMESPACE) && key !== CACHE_NAME,
  );
  if (cachesToDelete.length) {
    await Promise.all(cachesToDelete.map((key) => caches.delete(key)));
  }
};

/**------------------------------------------------------------------------------------------------
 * Events
 -------------------------------------------------------------------------------------------------*/

/**
 * Triggers when the Service Worker has been fetched and registered. It populates only this worker
 * version's cache, leaving the active worker and its cache available to existing clients.
 */
self.addEventListener('install', (event) => {
  if (CACHING) {
    event.waitUntil(precacheResources());
  }
});

/**
 * Triggers when the installed Service Worker becomes active. It deletes older application-owned
 * caches before taking control of existing clients.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (CACHING ? deleteOldCaches() : Promise.resolve()).then(() => self.clients.claim()),
  );
});

/**
 * Triggers when the page posts a message. The skip-waiting message, which jg-sw's updateApp()
 * posts, activates this worker while an older one still controls the page.
 */
self.addEventListener('message', (event) => {
  if (
    event.data !== null &&
    typeof event.data === 'object' &&
    event.data.type === SKIP_WAITING_MESSAGE_TYPE
  ) {
    event.waitUntil(self.skipWaiting());
  }
});

/**
 * Triggers when the app thread makes a network request. Same-origin GET requests are served from
 * the current version's cache when possible, then fetched and cached for future requests. Without
 * caching, no fetch handler is registered, so the browser skips the worker for requests.
 */
if (CACHING) {
  self.addEventListener('fetch', (event) => {
    if (shouldHandleRequest(event.request)) {
      event.respondWith(cacheFirst(event.request, event));
    }
  });
}
