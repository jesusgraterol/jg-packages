# jg-api-response

Build and recognise the `{ success, data, error }` envelope that services exchange over HTTP.

## Install

```bash
npm install jg-api-response
```

## Usage

Build the body a service responds with. A response is successful when no error is passed, and the error, whatever its shape, becomes a message:

```ts
import { buildResponse } from 'jg-api-response';
import { Exception } from 'jg-exception';

buildResponse({ id: 1 });
// { success: true, data: { id: 1 }, error: undefined }

buildResponse(undefined, new Exception('The user was not found.', 'USER_NOT_FOUND'));
// { success: false, data: undefined, error: 'The user was not found.' }
```

Check a body you received, after `JSON.parse` dropped its undefined fields or a service sent `error: null`:

```ts
import { isResponse } from 'jg-api-response';

const body: unknown = await response.json();
if (isResponse<IUser>(body)) {
  body.success; // boolean
  body.data; // IUser | undefined
  body.error; // string | null | undefined
}
```

## Coming from `api-response-utils`

| `api-response-utils`                      | `jg-api-response`                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `import … from 'api-response-utils'`      | `import … from 'jg-api-response'`                                                                                 |
| `isResponse` narrows to `IAPIResponse<T>` | `isResponse` narrows to the new `IParsedAPIResponse<T>`: `{ success: boolean; data?: T; error?: string \| null }` |

Changed behavior:

- `isResponse` accepts envelopes parsed from JSON, such as `{ "success": true }` and `{ "success": true, "error": null }`, which it used to reject because `data` or `error` was missing. It still rejects anything without a boolean `success`, or with an `error` that isn't a string or `null`.
- `buildResponse(data, error)` turns any error that is passed into a message, so `null`, `''`, and `0` produce a failed response with a message where they used to produce one with no `error`.

The wire format is unchanged.

## Documentation

The full API reference is at https://jg-packages.jesusgraterol.dev/packages/jg-api-response/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-api-response/LICENSE)
