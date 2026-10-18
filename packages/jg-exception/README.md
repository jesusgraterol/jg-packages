# jg-exception

Coded errors for every jg package: an Exception with a stable code and JSON data, message extraction, code checks, and test assertions.

## Install

```bash
npm install jg-exception
```

## Usage

Throw an `Exception` with a stable code, and optional data that helps whoever handles or debugs it:

```ts
import { Exception } from 'jg-exception';

throw new Exception('The user was not found.', { code: 'USER_NOT_FOUND', data: { id } });
```

Wrap the error underneath as the `cause`. The message says what failed at this step, and the cause keeps the rest:

```ts
try {
  await loadUser(id);
} catch (error) {
  throw new Exception("Couldn't load the user.", { code: 'USER_LOAD_FAILED', cause: error });
}
```

Read the code back wherever the error ends up. It works on any error with a string `code`, such as a Node.js system error:

```ts
import { getErrorCode, hasErrorCode, hasErrorCodePrefix, isException } from 'jg-exception';

hasErrorCode(error, 'USER_NOT_FOUND'); // true or false
hasErrorCodePrefix(error, 'USER_'); // true for any USER_ code
getErrorCode(error); // 'USER_NOT_FOUND', or null when the error has no code
isException(error); // true, even for an Exception from another installed copy of the package
```

An Exception turns into JSON with its name, code, message, and data, so it can be logged or sent as is:

```ts
JSON.stringify(
  new Exception('The user was not found.', { code: 'USER_NOT_FOUND', data: { id: 1 } }),
);
// '{"name":"Exception","code":"USER_NOT_FOUND","message":"The user was not found.","data":{"id":1}}'

String(error); // 'Exception [USER_NOT_FOUND]: The user was not found.'
```

An app's throw sites can also say how serious a failure is, for the code that reports it: `severity` is `'expected'` or `'critical'`, and `shouldLog: true` asks for the error to be logged in full. Neither is serialized, and packages never set them:

```ts
throw new Exception('The user was not found.', { code: 'USER_NOT_FOUND', severity: 'expected' });
```

`data` must be a JSON value, so a `BigInt`, a `Date`, or a class instance is a type error. An object's values may be `undefined`, so `{ email }` works when `email` is optional. An interface has no index signature, so pass an interface-typed value as `{ ...user }`, or declare its type with `type`. Whatever can't be serialized at runtime, such as an object that refers back to itself, becomes `null` in `toJSON()`, and `NaN` and `Infinity` become `null` as in any JSON.

Extract a readable message from anything a `catch` block receives: strings, errors with their causes, ZodErrors, and objects with a `message`, `error`, or `reason`:

```ts
import { extractMessage } from 'jg-exception';

extractMessage(new Error('Request failed', { cause: new Error('Timed out') }));
// 'Request failed; [CAUSE]: Timed out'
```

Turn an error into what users read with `createErrorFeedback`: the copy you wrote for its code, or a fallback, never the error's message, which is written for whoever debugs it:

```ts
import { createErrorFeedback } from 'jg-exception';

const getErrorFeedback = createErrorFeedback({
  fallbackMessage: 'Something went wrong.',
  messagesByCode: { SESSION_EXPIRED: 'Your session expired. Sign in again to continue.' },
});

getErrorFeedback(error).message; // the copy for the error's code, or the fallback
```

Assert error codes in tests with any test runner:

```ts
import { expectToRejectCode, expectToThrowCode } from 'jg-exception/testing';

expectToThrowCode(() => parseCursor('%%'), 'INVALID_CURSOR');
await expectToRejectCode(loadUser('missing'), 'USER_NOT_FOUND', 'not found');
```

### Keeping secrets out of an error

The error underneath can hold a secret in its message, stack, or fields, such as the token a request was sent with, and logs, `console.log`, and error trackers print the whole chain. When you wrap it, pass that value as `redact`. It's replaced by `[redacted]` throughout the new exception: its message and data, and each cause's message, stack, and fields, all the way down:

```ts
try {
  await verifyToken(token);
} catch (error) {
  throw new Exception("Couldn't verify the token.", {
    code: 'TOKEN_INVALID',
    cause: error,
    redact: [token],
  });
}
```

- **Pass whole secrets.** Each value is matched as written and URL-encoded, so a token in a request URL is found too. A fragment as short as `at` would also rewrite names and every stack frame. A value transformed another way, such as base64-encoded or hashed, isn't found, so pass each form a cause may hold.
- **What it costs:** each cause becomes a copy that keeps its name, code, message, stack, and plain fields, redacted, and leaves out fields holding objects, such as an HTTP client's `config`. The copy runs none of the cause's own code, such as a custom inspect hook, which could hold a value no redaction reaches. So `instanceof` the cause's original class no longer holds: read its `name` and `code` instead. An Exception cause stays an Exception, so `isException`, `hasErrorCode`, and `toJSON()` work on it.
- The values are used while the exception is built, and kept nowhere.

To log an error you caught, without rethrowing it, `extractRedactedMessage` gives its message, causes included, with the values redacted:

```ts
import { extractRedactedMessage } from 'jg-exception';

extractRedactedMessage(error, [apiKey]); // the message with the key replaced by [redacted]
```

When what you report carries the client's data, such as the body of the request that failed, the secrets are in fields you know by name. `redactFields` copies it with those fields' values replaced by `[redacted]`, at any depth and whatever their case:

```ts
import { redactFields } from 'jg-exception';

redactFields(request.body, ['password', 'token']); // { email: '…', password: '[redacted]' }
```

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-exception/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-exception/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-exception/LICENSE)
