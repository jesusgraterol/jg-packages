# jg-fetch recipes

Patterns for apps that call HTTP APIs with jg-fetch: a typed client for an envelope API, auth headers that stay fresh, and retries that never repeat an unsafe request.

## A typed client for an envelope API

When your app calls an API that answers with jg-api-response envelopes, keep the base URL, the envelope parsing, and the auth header in one function, and give each endpoint its own schema. Every call then resolves to data its schema checked, or to a `FetchException` whose `code` is the API's own.

```ts
import { request, type IRequestOptions, type IRequestResult, type ISchema } from 'jg-fetch';

// a Zod schema, or any validator with parse
declare const UserSchema: { parse(value: unknown): IUser };

// what an endpoint may set; the client sets the rest
type ICallOptions<T> = Omit<IRequestOptions<T>, 'baseUrl' | 'parseAs' | 'schema' | 'headers'>;

// every call reads an envelope, checks its data with the endpoint's schema, and sends a token
// read before each attempt
const callApi = <T>(
  path: string,
  schema: ISchema<T>,
  options: ICallOptions<T> = {},
): Promise<IRequestResult<T>> =>
  request<T>(path, {
    ...options,
    baseUrl,
    parseAs: 'envelope',
    schema,
    headers: async () => ({ authorization: `Bearer ${await getToken()}` }),
  });

export const getUser = (userId: number): Promise<IRequestResult<IUser>> =>
  callApi(`/users/${userId}`, UserSchema);

export const renameUser = (userId: number, name: string): Promise<IRequestResult<IUser>> =>
  callApi(`/users/${userId}`, UserSchema, { method: 'PATCH', body: { name } });
```

The schema runs on the envelope's `data`. When the API's answer doesn't match it, the call fails with `RESPONSE_INVALID` and the schema's error as `cause`, so a changed API shows up as an error here instead of as data of the wrong shape further on.

Handle failures where you know what each one means. A `FetchException`'s `kind` says what failed, one of `ERRORS`. For an `API_ERROR`, its `code` is the one in the envelope, such as `USER_NOT_FOUND`, which `hasErrorCode` checks; for every other kind, the code is the kind itself.

```ts
import { hasErrorCode } from 'jg-exception';
import { ERRORS, type IRequestResult } from 'jg-fetch';

// the client's getUser, from the block above
declare function getUser(userId: number): Promise<IRequestResult<IUser>>;

// sends an error to your error tracker
declare function trackError(error: unknown): void;

// what the profile page shows
type IProfileState =
  | { status: 'ready'; user: IUser }
  | { status: 'not-found' }
  | { status: 'unreachable' }
  | { status: 'failed' };

const loadProfile = async (userId: number): Promise<IProfileState> => {
  const { data, error } = await getUser(userId);
  if (error === null) {
    return { status: 'ready', user: data };
  }
  // the code the API sent in the envelope
  if (hasErrorCode(error, 'USER_NOT_FOUND')) {
    return { status: 'not-found' };
  }
  // the API couldn't be reached or didn't answer in time, even after the retries, so trying
  // again later may work
  if (error.kind === ERRORS.NETWORK_ERROR || error.kind === ERRORS.TIMEOUT) {
    return { status: 'unreachable' };
  }
  // anything else is a bug on one side, such as RESPONSE_INVALID when the API's data stopped
  // matching the schema
  trackError(error);
  return { status: 'failed' };
};
```

When the caller has to throw instead, such as on a server, pass the `FetchException` as the `cause` of your own error: `new Exception("Couldn't load the profile.", { code: 'PROFILE_UNAVAILABLE', cause: error })`. Your message says what failed at your step, and the cause keeps the request's kind, status, and attempts. A `FetchException`'s message never includes the URL or the body.

## A fresh auth header on every request

Pass `headers` as a function when a header holds a token that expires. `request` calls it before every attempt, retries included, so each attempt sends the token as it is when that attempt starts.

```ts
import { request } from 'jg-fetch';

// the token in an object is read once, before the call: a retry seconds later sends the same
// token, even if it expired in between
await request('/reports', {
  baseUrl,
  headers: { authorization: `Bearer ${await getToken()}` },
});

// a function runs before every attempt
await request('/reports', {
  baseUrl,
  headers: async () => ({ authorization: `Bearer ${await getToken()}` }),
});
```

The function receives an `IAttemptContext`: the attempt's number, from 1, and a `signal` that aborts when the attempt is cancelled, by its own timeout, the call's, or your `signal`. `request` stops waiting for the function when that signal aborts, so a token call that hangs ends the attempt like a slow response: as an attempt timeout, which can retry, when `attemptTimeoutSeconds` runs out, or as the call's `TIMEOUT` when `timeoutSeconds` does. A function that throws or rejects ends the call with `INVALID_HEADERS` and its error as `cause`, without a retry, which usually means the user has to sign in again.

A token can also stop working before it expires, such as when it's revoked. `request` never retries a `401` on its own, because the same token would fail again. Pass `refreshCredentials`, which `request` calls when an attempt fails with a response: refresh the token and return `true`, and the attempt is repeated at once, with `headers` called again. Return `false` for any other failure, which the retry rules then handle:

```ts
import { request, type ICredentialFailure } from 'jg-fetch';

// gets a new access token from the auth server, which getToken returns from then on; the signal
// aborts when the call is cancelled
declare function refreshToken(signal: AbortSignal): Promise<string>;

// refreshes the token only for a credential failure: the server didn't process the request then,
// so repeating it is safe, even for a POST
const refreshOnUnauthorized = async ({ status, signal }: ICredentialFailure): Promise<boolean> => {
  if (status !== 401) {
    return false;
  }
  await refreshToken(signal);
  return true;
};

const { data, error } = await request('/reports', {
  baseUrl,
  method: 'POST',
  body: { range: 'last-30-days' },
  headers: async () => ({ authorization: `Bearer ${await getToken()}` }),
  refreshCredentials: refreshOnUnauthorized,
});
```

A call refreshes once by default, so a second `401` means the session is over: send the user to sign in. Set `maxCredentialRefreshes` when more than one credential can expire, such as an App Check token and an ID token, and tell them apart by `code`, the envelope error's code with `parseAs: 'envelope'`. A refresh that throws ends the call with `CREDENTIALS_REFRESH_FAILED`, its error as `cause`, and the response's status. A refresh doesn't use up a retry, and the call's `timeoutSeconds` covers it, so a refresh that hangs ends as `TIMEOUT`. A streamed body is never repeated, so its failure goes straight to the retry rules. When several calls can get a `401` at once, have `refreshToken` share one refresh between them, and don't let one call's signal cancel a refresh the others are waiting on.

## Retrying only what's safe to retry

A retry sends the request again, so it's safe only when a second copy can't do something twice. `request` retries `GET`, `HEAD`, and `OPTIONS` by default, after network errors, attempt timeouts, and the statuses in `DEFAULT_RETRY_STATUS_CODES`. Tune what a read retries on:

```ts
import { request } from 'jg-fetch';

// a GET retries network errors, attempts that time out, and 408, 429 with Retry-After, 500,
// 502, 503, and 504, waiting 3 and then 5 seconds, within timeoutSeconds
const users = await request<IUser[]>('/users', {
  baseUrl,
  parseAs: 'envelope',
  // a hung attempt ends after 4 seconds and retries, instead of using up the call's 15
  attemptTimeoutSeconds: 4,
  // the API answers 503 with this code during maintenance, which lasts longer than any retry waits
  nonRetryableErrorCodes: ['MAINTENANCE'],
  // a call that succeeds on a retry still leaves a trace of the failures before it
  onRetry: ({ attempt, error, delayMs }) => {
    console.warn(`Attempt ${attempt} failed with ${error.code}; retrying in ${delayMs} ms.`);
  },
});
```

Some failures never retry, whatever the options say: the statuses in `NON_RETRYABLE_STATUS_CODES` (400 to 405, 409, 410, 413, and 422), an abort, the whole call's timeout, and a stream body, which can only be sent once. When a `Retry-After` asks for longer than `maxRetryAfterSeconds`, or than the time left, the call stops, and the error's `retryAfterMs` says how long the server asked you to wait.

A `POST` doesn't retry by default. When a network error cuts the connection, there's no telling whether the server created the order, and a retry could create a second one. Make it safe with an idempotency key, created once per order and sent on every attempt, then opt the request in:

```ts
import { request } from 'jg-fetch';

// what the checkout form sends
declare const order: { items: { productId: number; quantity: number }[] };

// one key per order, created before the first attempt, so every retry sends the same one
const idempotencyKey = crypto.randomUUID();

const { data, error } = await request<{ orderId: number }>('/orders', {
  baseUrl,
  method: 'POST',
  body: order,
  parseAs: 'envelope',
  headers: async () => ({
    authorization: `Bearer ${await getToken()}`,
    'idempotency-key': idempotencyKey,
  }),
  // safe only because the API stores the key and answers a repeat with the first result
  retryMethods: ['POST'],
});
```

The key protects you only if the API stores it and answers a repeated key with the first result instead of acting again; without that, leave `POST` out of `retryMethods`. Create the key when the checkout starts rather than on each submit, and a second click on the button is safe too. `PUT`, `PATCH`, and `DELETE` are also off the default list, because only your API knows whether repeating them is harmless.
