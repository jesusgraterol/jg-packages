# jg-fetch

A fetch wrapper for browsers and Node.js that never throws: timeouts, retries with Retry-After, response caps, and API envelopes.

## Install

```bash
npm install jg-fetch
```

## Usage

`request` resolves to `{ data, error: null, meta }` or `{ data: null, error, meta }`, and never throws:

```ts
import { request } from 'jg-fetch';

const { data, error, meta } = await request<IUser>('https://api.example.com/users/1');
if (error) {
  error.kind; // what failed, such as 'TIMEOUT', 'NETWORK_ERROR', or 'HTTP_ERROR'
  error.status; // 404, or null when no response arrived
} else {
  data; // IUser
}
meta.attempts; // 1
```

Read a jg-api-response envelope, validate its data, and send a fresh token on every attempt:

```ts
import { request } from 'jg-fetch';
import { z } from 'zod';

const User = z.object({ id: z.number(), name: z.string() });

const { data, error } = await request('/users/me', {
  baseUrl: 'https://api.example.com',
  parseAs: 'envelope', // resolves to the envelope's data
  schema: User, // data is { id: number; name: string }
  headers: async () => ({ authorization: `Bearer ${await getIdToken()}` }),
});
if (error?.kind === 'API_ERROR') {
  error.code; // the API's own code, such as 'USER_NOT_FOUND'
  error.data; // the envelope's data
}
```

Send JSON, query parameters, or any other body:

```ts
await request('/orders', {
  baseUrl,
  method: 'POST',
  body: { items: [1, 2] }, // sent as JSON, with Content-Type: application/json
  query: { notify: true, tags: ['a', 'b'] }, // ?notify=true&tags=a&tags=b
});
await request('/avatar', { baseUrl, method: 'PUT', body: formData }); // the browser sets the multipart type
```

Read other kinds of responses with `parseAs`: `'json'` (the default), `'envelope'`, `'text'`, `'bytes'`, `'blob'`, `'response'` for the unread `Response`, or `'none'`. The data's type follows it.

### Timeouts and retries

| Option                   | Default                                  | What it does                                                                       |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `timeoutSeconds`         | `15`                                     | Limits the whole call, retries and waits included.                                 |
| `attemptTimeoutSeconds`  | none                                     | Limits each attempt; an attempt that runs out retries.                             |
| `retryDelaysSeconds`     | `[3, 5]`                                 | The waits before each retry. `[]` turns retries off.                               |
| `retryMethods`           | `GET`, `HEAD`, `OPTIONS`                 | The methods that may retry. Add `POST` only for requests that are safe to repeat.  |
| `retryStatusCodes`       | `408`, `429`, `500`, `502`, `503`, `504` | The statuses that may retry. `400`–`405`, `409`, `410`, `413`, and `422` never do. |
| `nonRetryableErrorCodes` | none                                     | API error codes that never retry.                                                  |
| `maxRetryAfterSeconds`   | `30`                                     | The longest `Retry-After` a retry waits for.                                       |
| `maxResponseBytes`       | 10 MiB                                   | The largest body the buffered modes read.                                          |

Network errors, attempt timeouts, and retryable statuses retry. A `429` retries only with `Retry-After`, and every retry waits the longer of its delay and `Retry-After`. When `Retry-After` asks for more than `maxRetryAfterSeconds`, or more than the time left, the call stops and the error carries `retryAfterMs`. A stream body never retries.

Pass `signal` to cancel: its abort reports `ABORTED`, or `TIMEOUT` when its reason is a `TimeoutError`, such as `AbortSignal.timeout(5000)`'s.

### Errors

The error is a `FetchException`, an `Exception` from `jg-exception`:

| Field                                     | Holds                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `kind`                                    | What failed, one of `ERRORS`                                             |
| `code`                                    | The API's own code for an `API_ERROR`, otherwise the kind                |
| `status`, `headers`, `body`               | The response's status, headers, and body, parsed as JSON when it is JSON |
| `data`                                    | The envelope's data, for an `API_ERROR`                                  |
| `retryAfterMs`                            | The wait `Retry-After` asked for                                         |
| `method`, `url`, `attempts`, `durationMs` | The request, without its query string or fragment                        |
| `cause`                                   | The original error                                                       |

Messages never include the URL or the body, and `url` and `meta.url` drop the query string and fragment, where tokens such as `?key=` sit.

### Reading headers across origins

A browser lets the page read only a few response headers from another origin. To read `Retry-After`, a `cf-ray`, or any custom header, the API must list them in `Access-Control-Expose-Headers`. Otherwise `headers.get()` returns `null`, and a `429` never retries, because its `Retry-After` can't be read.

## Coming from `fetch-request-browser` and `fetch-request-node`

| `fetch-request-browser` and `fetch-request-node`            | `jg-fetch`                                           |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| `send(input, options)`                                      | `request(url, options)`                              |
| `sendGET`, `sendPOST`, `sendPUT`, `sendPATCH`, `sendDELETE` | `request(url, { method })`                           |
| `retryDelaySchedule` (browser)                              | `retryDelaysSeconds`                                 |
| `skipStatusCodeValidation`                                  | read `error.status`, `error.body` and `meta` instead |
| `IRequestMethod`                                            | `IHttpMethod`                                        |
| `IResponseDataType`                                         | `IParseAs`                                           |
| `IRequestResponse`                                          | `IRequestResult<T>`                                  |
| thrown encoded errors                                       | the returned `error`, a `FetchException`             |

`IRequestInput`, `IRequestOptions`, and `IOptions` are replaced by `string | URL` and the new `IRequestOptions<T>`.

- One package works in browsers and Node.js.
- `request` never throws: every failure is returned, with its `kind`.
- Retry decisions match exact statuses, not substrings of the message, and only the methods in `retryMethods` retry, which leaves out `POST` by default.
- Every call has a timeout, 15 seconds by default, and buffered bodies are capped at 10 MiB.
- A redirect no longer logs a warning.

## Documentation

The full API reference is at https://jg-packages.jesusgraterol.dev/packages/jg-fetch/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-fetch/LICENSE)
