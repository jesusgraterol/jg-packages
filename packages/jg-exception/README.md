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

`data` must be a JSON value, so a `BigInt`, a `Date`, or a class instance is a type error. An object's values may be `undefined`, so `{ email }` works when `email` is optional. An interface has no index signature, so pass an interface-typed value as `{ ...user }`, or declare its type with `type`. Whatever can't be serialized at runtime, such as an object that refers back to itself, becomes `null` in `toJSON()`, and `NaN` and `Infinity` become `null` as in any JSON.

Extract a readable message from anything a `catch` block receives: strings, errors with their causes, ZodErrors, and objects with a `message`, `error`, or `reason`:

```ts
import { extractMessage, extractRedactedMessage } from 'jg-exception';

extractMessage(new Error('Request failed', { cause: new Error('Timed out') }));
// 'Request failed; [CAUSE]: Timed out'
extractRedactedMessage(error, [apiKey]); // the message with the key replaced by [redacted]
```

Assert error codes in tests with any test runner:

```ts
import { expectToRejectCode, expectToThrowCode } from 'jg-exception/testing';

expectToThrowCode(() => parseCursor('%%'), 'INVALID_CURSOR');
await expectToRejectCode(loadUser('missing'), 'USER_NOT_FOUND', 'not found');
```

## Documentation

The full API reference is at https://jg-packages.jesusgraterol.dev/packages/jg-exception/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-exception/LICENSE)
