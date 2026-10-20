# jg-utilities recipes

Patterns for apps that page through lists, cache results by request, check what clients send, and share a rate-limited API, with jg-utilities' cursor codecs, JSON helpers, validations, and request coordinator.

## Paginating with cursors

For a list that grows while people page through it, such as a feed or an order history, page by position instead of by offset. Each page ends with a cursor that holds the sort keys of its last row, and the next request reads the rows after it. Rows added in between don't shift the pages, and the database seeks to the position instead of counting past an offset.

```ts
import { createCursorCodec, isStringValid } from 'jg-utilities';

// an order in the list, which is sorted newest first
type IOrder = { id: string; createdAt: string; total: number };

// the list's filter, and where a page ended: the sort keys of its last row
type IOrderCursor = { status: string | null; createdAt: string; id: string };

// a page, and the cursor for the next one, or null after the last
type IOrderPage = { items: IOrder[]; nextCursor: string | null };

// reads the orders with a status after a position, or from the start for null, such as with
// WHERE status = $1 AND (created_at, id) < ($2, $3) ORDER BY created_at DESC, id DESC LIMIT $4
declare function findOrders(
  status: string | null,
  after: IOrderCursor | null,
  limit: number,
): Promise<IOrder[]>;

const PAGE_SIZE = 20;

// a client can encode any JSON itself, so the codec checks each cursor with this schema, which
// could be a Zod schema instead, and accepts it only for the status it was made for
const orderCursors = createCursorCodec<IOrderCursor, { status: string | null }>({
  schema: {
    parse: (value) => {
      const { status, createdAt, id } = value as Partial<IOrderCursor>;
      if (
        (status !== null && !isStringValid(status)) ||
        !isStringValid(createdAt) ||
        !isStringValid(id)
      ) {
        throw new TypeError('The value is not an order cursor.');
      }
      return { status, createdAt, id };
    },
  },
});

// a plain handler: it takes the request's query string and returns the page
const listOrders = async (searchParams: URLSearchParams): Promise<IOrderPage> => {
  const status = searchParams.get('status');
  const after = orderCursors.decode(searchParams.get('cursor'), { status }) ?? null;
  // one row more than a page holds says whether another page follows
  const rows = await findOrders(status, after, PAGE_SIZE + 1);
  const items = rows.slice(0, PAGE_SIZE);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > PAGE_SIZE && last !== undefined
        ? orderCursors.encode({ status, createdAt: last.createdAt, id: last.id })
        : null,
  };
};
```

Without a cursor, `decode` returns `undefined`, the first page. A cursor it can't accept throws `INVALID_CURSOR`, whether its encoding, its shape, or its status is wrong, which `data.reason` says, so your error handler answers it with a `400`. The codec also refuses a cursor longer than 2048 characters, unless you pass another `maxLength`, and won't encode one that long either.

A cursor is opaque, but not secret or signed: it's base64url JSON, which a client can decode and change. The status check stops a cursor made for one filter from being replayed with another, but a client could still write one by hand, so this is only harmless while a cursor picks a position in rows the user can already read. Never put anything in a cursor that the client mustn't see.

When an API pages by the last row's id instead, such as `?after=42`, `getNextPageParam` reads the next id from a page: the last row's when the page is full, or `undefined` after a short page, which is the last.

```ts
import { getNextPageParam } from 'jg-utilities';

// a chat message
type IMessage = { id: number; text: string };

// reads up to limit messages after an id, oldest first, or from the start without one
declare function fetchMessages(after: number | undefined, limit: number): Promise<IMessage[]>;

const PAGE_SIZE = 50;

// reads every page, until a short one says there are no more
const messages: IMessage[] = [];
let after: number | undefined;
do {
  const page = await fetchMessages(after, PAGE_SIZE);
  messages.push(...page);
  after = getNextPageParam('id', page, PAGE_SIZE);
} while (after !== undefined);
```

When the last page happens to be full, this costs one more request, which comes back empty. A server that sends a `nextCursor`, as the handler above does, saves it.

## Stable cache keys from JSON

To cache a result by the request that produced it, such as a search, build the key from the request's parameters with `stringifyJsonDeterministically`, which sorts object keys at every depth, in RFC 8785's order. `{ q, sort }` and `{ sort, q }` then share one entry, where `JSON.stringify` would give two. Strict mode accepts only plain JSON data, so a value that would serialize lossily, such as a Date or an `undefined` that slipped past the normalization, throws instead of making a key that another search shares.

```ts
import { createHash } from 'node:crypto';

import {
  normalizeQuery,
  parseJson,
  pruneJson,
  stringifyJson,
  stringifyJsonDeterministically,
} from 'jg-utilities';

// the filters of a product search, as the request sends them
type ISearchFilters = {
  q?: string;
  tags?: string[];
  maxPrice?: number | null;
  sort?: 'price' | 'newest';
};

// a product a search finds
type IProduct = { id: string; name: string; price: number };

// a key-value store with expiry, such as Redis
declare const cache: {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};

// runs the search on the database
declare function searchProducts(filters: ISearchFilters): Promise<IProduct[]>;

// the same search gives the same key, however the client ordered or spaced it
const toSearchCacheKey = (filters: ISearchFilters): string => {
  // pruneJson drops null, undefined, and empty arrays and objects, so { tags: [] } matches {}
  const normalized = pruneJson({
    ...filters,
    // text that differs only in case or spacing finds the same products, and blank text is none
    q: normalizeQuery(filters.q ?? '') || undefined,
    // the tags' order doesn't change the result, so it doesn't change the key
    tags: filters.tags?.toSorted(),
  });
  const json = stringifyJsonDeterministically(normalized ?? {}, { strict: true });
  // a hash keeps the key short whatever the filters hold; the prefix says what's cached, and the
  // version of its shape
  return `products:search:v1:${createHash('sha256').update(json).digest('base64url')}`;
};

const searchProductsCached = async (filters: ISearchFilters): Promise<IProduct[]> => {
  const key = toSearchCacheKey(filters);
  const cached = await cache.get(key);
  if (cached !== null) {
    return parseJson<IProduct[]>(cached);
  }
  const products = await searchProducts(filters);
  await cache.set(key, stringifyJson(products), 60);
  return products;
};
```

Arrays keep their order, because it often matters, so sort the ones where it doesn't, as the tags are here. Change the version in the prefix when the cached value's shape changes, so old entries are never read as new ones.

The same key works in memory without a hash, such as to share one request between the parts of a page that ask for the same search at once:

```ts
import { stringifyJsonDeterministically } from 'jg-utilities';

// the filters of a product search
type ISearchFilters = { q?: string; tags?: string[]; sort?: 'price' | 'newest' };

// a product a search finds
type IProduct = { id: string; name: string; price: number };

// sends the search to the API
declare function fetchProducts(filters: ISearchFilters): Promise<IProduct[]>;

// the searches in flight, by key
const inFlight = new Map<string, Promise<IProduct[]>>();

const searchProductsOnce = (filters: ISearchFilters): Promise<IProduct[]> => {
  const key = stringifyJsonDeterministically(filters);
  const pending = inFlight.get(key);
  if (pending !== undefined) {
    return pending;
  }
  // the entry leaves once the request settles, so a later search asks again
  const search = fetchProducts(filters).finally(() => inFlight.delete(key));
  inFlight.set(key, search);
  return search;
};
```

## Validating input at the edge

Check what a client sends where it enters your app, then pass typed values inward. jg-utilities has no schema builder: its validations are type guards, which fit a handful of flat fields. For nested or larger input, use a schema, such as a Zod one.

```ts
import { Exception } from 'jg-exception';
import { isEmailValid, isObjectValid, isPasswordValid, isStringValid } from 'jg-utilities';

// the sign-up form, once it's checked
type ISignUpInput = { email: string; password: string; name: string };

// one code for every rejected field, with the field's name in data, so the client can mark it
const invalidInput = (field: string): Exception =>
  new Exception(`The ${field} is invalid.`, { code: 'INVALID_INPUT', data: { field } });

// checks the parsed JSON body one field at a time
const readSignUpInput = (body: unknown): ISignUpInput => {
  if (!isObjectValid(body)) {
    throw invalidInput('body');
  }
  const { email, password, name } = body;
  if (!isEmailValid(email)) {
    throw invalidInput('email');
  }
  if (!isPasswordValid(password)) {
    throw invalidInput('password');
  }
  if (!isStringValid(name, 1, 100)) {
    throw invalidInput('name');
  }
  return { email: email.toLowerCase(), password, name: name.trim() };
};
```

Each guard narrows its field, so the returned object needs no casts, and building a new object drops whatever else the client sent, such as an `isAdmin` flag. The error names the field in `data`, never its value, which here could be a password.

Query strings and headers arrive as strings or `null`. Check each string before you convert it, and map each code to a status in one place:

```ts
import { buildResponse } from 'jg-api-response';
import { Exception, hasErrorCode } from 'jg-exception';
import {
  extractTokenFromAuthorizationHeader,
  isAuthorizationHeaderValid,
  isIntegerValid,
  isNumeric,
  normalizeQuery,
} from 'jg-utilities';

// an order a search finds
type IOrder = { id: string; total: number };

// reads the user a token belongs to, such as by verifying a JWT
declare function verifyToken(token: string): Promise<{ userId: string }>;

// searches a user's orders
declare function searchOrders(userId: string, query: string, limit: number): Promise<IOrder[]>;

// reads ?limit=, from 1 to 100, or 20 without one
const readLimit = (value: string | null): number => {
  if (value === null) {
    return 20;
  }
  // isNumeric rejects '', ' 12', and '0x10', which Number reads as 0, 12, and 16
  const limit = Number(value);
  if (!isNumeric(value) || !isIntegerValid(limit, 1, 100)) {
    throw new Exception('The limit is invalid.', {
      code: 'INVALID_INPUT',
      data: { field: 'limit' },
    });
  }
  return limit;
};

// a plain handler: the framework passes the query string and the Authorization header, and
// sends back the status and the body
const listOrders = async (searchParams: URLSearchParams, authorization: string | null) => {
  try {
    if (!isAuthorizationHeaderValid(authorization)) {
      throw new Exception('The request has no valid bearer token.', { code: 'UNAUTHENTICATED' });
    }
    const { userId } = await verifyToken(extractTokenFromAuthorizationHeader(authorization));
    const limit = readLimit(searchParams.get('limit'));
    // searches that differ only in case or spacing run as one, cut to 100 characters
    const query = normalizeQuery(searchParams.get('q') ?? '', 100);
    return { status: 200, body: buildResponse(await searchOrders(userId, query, limit)) };
  } catch (error) {
    if (hasErrorCode(error, 'UNAUTHENTICATED')) {
      return { status: 401, body: buildResponse(null, error) };
    }
    if (hasErrorCode(error, 'INVALID_INPUT')) {
      return { status: 400, body: buildResponse(null, error) };
    }
    // anything else is the app's own failure, for the error handler every route shares
    throw error;
  }
};
```

Checking the header with `isAuthorizationHeaderValid` before `extractTokenFromAuthorizationHeader` turns a missing or malformed header into the handler's own `UNAUTHENTICATED`, answered with a 401, so it never reaches the shared error handler as jg-utilities' `INVALID_AUTHORIZATION_HEADER`, which that handler doesn't know.

## Waiting out a rate limit across requests

Use this when many requests share one rate-limited API, such as GitHub's for an app installation. A coordinator runs at most a few at a time, queues the rest, and, once a response says to wait with `Retry-After`, holds every queued request until then, without retrying them one by one. jg-fetch's retries handle one request; the coordinator keeps a whole app's requests in line.

```ts
import { hasErrorCode } from 'jg-exception';
import { createRequestCoordinator, ERRORS } from 'jg-utilities';

// GitHub's requests for every installation, four at a time, with up to 256 waiting
const github = createRequestCoordinator({ maxConcurrent: 4, maxQueued: 256 });

// the time a Retry-After header names, as seconds or as an HTTP date, in epoch milliseconds
const readRetryAt = (response: Response): number | undefined => {
  const header = response.headers.get('retry-after');
  if (header === null) {
    return undefined;
  }
  const seconds = Number(header);
  const retryAt = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(header);
  return Number.isNaN(retryAt) ? undefined : retryAt;
};

// one installation's request, which waits behind at most 32 of its own
export const requestGitHub = (installationId: number, url: string, signal: AbortSignal) =>
  github.run(
    async () => {
      const response = await fetch(url, { signal });
      const retryAt =
        response.status === 403 || response.status === 429 ? readRetryAt(response) : undefined;
      if (retryAt !== undefined) {
        github.deferUntil(retryAt);
      }
      return response;
    },
    { signal, caller: installationId, maxQueuedForCaller: 32 },
  );

// a webhook that answers at once instead of waiting: GitHub redelivers it after a 503
export const handleWebhook = async (installationId: number, url: string, signal: AbortSignal) => {
  try {
    await github.run(() => fetch(url, { signal }), {
      signal,
      caller: installationId,
      rejectDuringCooldown: true,
    });
    return { status: 202 };
  } catch (error) {
    if (
      hasErrorCode(error, ERRORS.REQUEST_COOLDOWN_ACTIVE) ||
      hasErrorCode(error, ERRORS.REQUEST_QUEUE_FULL)
    ) {
      return { status: 503 };
    }
    throw error;
  }
};
```

A request that waits for a slot holds nothing: the cooldown blocks no slot, and an aborted signal takes its request out of the queue. `maxQueuedForCaller` keeps one busy installation from filling the queue for the rest. Discard the coordinator only when `isIdle()` is true, or call `close()`, which rejects what's still waiting.
