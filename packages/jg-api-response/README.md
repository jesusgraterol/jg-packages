# jg-api-response

Build and recognise the `{ success, data, error }` envelope that services exchange over HTTP, with errors carried as a code, a message, and data.

## Install

```bash
npm install jg-api-response
```

## Usage

Build the body a service responds with. A response is successful when no error is passed:

```ts
import { buildResponse } from 'jg-api-response';

buildResponse({ id: 1 });
// { success: true, data: { id: 1 }, error: null }
```

A failed response carries the error as `{ code, message, data }`, so the client gets everything it needs to handle or debug it. An `Exception` from `jg-exception` keeps its code, message, and data:

```ts
import { Exception } from 'jg-exception';

buildResponse(
  undefined,
  new Exception('The user was not found.', { code: 'USER_NOT_FOUND', data: { id: 1 } }),
);
// {
//   success: false,
//   data: undefined,
//   error: { code: 'USER_NOT_FOUND', message: 'The user was not found.', data: { id: 1 } },
// }
```

Any other error keeps its string `code`, such as a Node.js `ENOENT`, or gets `UNKNOWN_ERROR`, with its message and `null` data:

```ts
buildResponse(undefined, new Error('Request failed'));
// { success: false, data: undefined, error: { code: 'UNKNOWN_ERROR', message: 'Request failed', data: null } }
```

The envelope can always be serialized when its data can: Exception data that JSON can't hold becomes `null`.

Check a body you received, after `JSON.parse` dropped its undefined fields, or from a service that leaves out `error` or its `data`:

```ts
import { isResponse } from 'jg-api-response';

const body: unknown = await response.json();
if (isResponse<IUser>(body)) {
  body.success; // boolean
  body.data; // IUser | undefined
  body.error; // { code: string; message: string; data?: unknown } | null | undefined
}
```

`isResponse` checks the error's `code` and `message`, but not its `data`, which is `unknown` until you check it.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-api-response/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-api-response/LICENSE)
