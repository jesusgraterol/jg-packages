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
  error.code; // the envelope error's code, such as 'USER_NOT_FOUND'
  error.message; // the envelope error's message
  error.data; // the envelope error's data, or null without any
  error.body; // the whole envelope
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

A string, `Blob`, `ArrayBuffer` or view of one, `FormData`, `URLSearchParams`, or `ReadableStream` is sent as it is. Any other body, such as a `Map`, a `Date`, or a number, fails with `INVALID_BODY` before the request is sent, because `fetch` would turn it into text such as `[object Map]`.

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

| Field                                     | Holds                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `kind`                                    | What failed, one of `ERRORS`                                                                 |
| `code`, `message`                         | The envelope error's code and message for an `API_ERROR`, otherwise the kind and its message |
| `status`, `headers`, `body`               | The response's status, headers, and body, parsed as JSON when it is JSON                     |
| `data`                                    | The envelope error's data for an `API_ERROR`, `null` when it has none; otherwise undefined   |
| `retryAfterMs`                            | The wait `Retry-After` asked for                                                             |
| `method`, `url`, `attempts`, `durationMs` | The request, without its query string or fragment                                            |
| `cause`                                   | The original error                                                                           |

Messages never include the URL or the body, and `url` and `meta.url` drop the query string and fragment, where tokens such as `?key=` sit.

### Reading headers across origins

A browser lets the page read only a few response headers from another origin. To read `Retry-After`, a `cf-ray`, or any custom header, the API must list them in `Access-Control-Expose-Headers`. Otherwise `headers.get()` returns `null`, and a `429` never retries, because its `Retry-After` can't be read.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-fetch/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-fetch/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-fetch/LICENSE)
