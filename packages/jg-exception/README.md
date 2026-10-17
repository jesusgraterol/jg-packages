# jg-exception

Extract, encode, and decode error messages and codes from errors of any shape, with a coded Exception class.

## Install

```bash
npm install jg-exception
```

## Usage

Throw coded errors, and read the code back wherever the error ends up:

```ts
import { Exception, getErrorCode, hasErrorCode, isException } from 'jg-exception';

throw new Exception('The user was not found.', 'USER_NOT_FOUND', { userId });

// elsewhere
if (hasErrorCode(error, 'USER_NOT_FOUND')) {
  // handle it
}
getErrorCode(error); // 'USER_NOT_FOUND', or null when the error has no code
isException(error); // true, even for an Exception from another installed copy of the package
```

Extract a readable message from anything a `catch` block receives: strings, errors with their causes, ZodErrors, and objects with a `message`, `error`, or `reason`:

```ts
import { extractMessage, extractRedactedMessage } from 'jg-exception';

extractMessage(new Error('Request failed', { cause: new Error('Timed out') }));
// 'Request failed; [CAUSE]: Timed out'
extractRedactedMessage(error, [apiKey]); // the message with the key replaced by [redacted]
```

Send a code across a boundary that only carries text, such as an HTTP response, and decode it on the other side:

```ts
import { decodeError, encodeError } from 'jg-exception';

const encoded = encodeError('The user was not found.', 'USER_NOT_FOUND');
// 'The user was not found.{(USER_NOT_FOUND)}'
decodeError(encoded);
// { message: 'The user was not found.', code: 'USER_NOT_FOUND', data: null }
```

Assert error codes in tests with any test runner:

```ts
import { expectToRejectCode, expectToThrowCode } from 'jg-exception/testing';

expectToThrowCode(() => parseCursor('%%'), 'INVALID_CURSOR');
await expectToRejectCode(loadUser('missing'), 'USER_NOT_FOUND', 'not found');
```

## Coming from `error-message-utils`

| `error-message-utils`                                          | `jg-exception`                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------- |
| `import … from 'error-message-utils'`                          | `import … from 'jg-exception'`                                        |
| `expectToThrowCode`, `expectToRejectCode` from `web-utils-kit` | `expectToThrowCode`, `expectToRejectCode` from `jg-exception/testing` |
| `DEFAULT_CODE` is `-1`                                         | `DEFAULT_CODE` is `'-1'`                                              |
| no way to recognise an `Exception` from another installed copy | `isException(value)`                                                  |

Changed behavior:

- Decoded codes are always strings. `decodeError(...).code`, `getErrorCode()`, `Exception.code`, and `toRecord().code` return `'404'` where they returned `404`. Codes can still be passed as numbers.
- `hasErrorCode` compares codes as strings, so `404` and `'404'` match each other.
- `hasErrorCodePrefix` matches numeric codes by their string form, so a code `404` matches the prefix `'4'`.
- ZodErrors are recognised by their shape, so the package no longer depends on zod, and errors from any copy of zod are handled.

The wire format, `message{(code)}`, is unchanged, so services on either package read each other's errors.

## Documentation

The full API reference is at https://jg-packages.jesusgraterol.dev/packages/jg-exception/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-exception/LICENSE)
