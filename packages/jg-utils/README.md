# jg-utils

Validations, transformers, generators, and collection, async, and environment utilities for browsers and Node.js.

## Install

```bash
npm install jg-utils
```

## Usage

Validate input before using it:

```ts
import { isEmailValid, isIntegerValid, isStringValid } from 'jg-utils';

isStringValid(name, 1, 100); // a non-blank string of 1 to 100 characters
isIntegerValid(page, 1); // an integer of at least 1
isEmailValid(email); // a valid address without a forbidden extension
```

Format values for people:

```ts
import { prettifyDate, prettifyFileSize, prettifyNumber, toSlug } from 'jg-utils';

prettifyNumber(1234567.891); // '1,234,567.89'
prettifyFileSize(1536); // '1.50 kB'
prettifyDate(createdAt, 'date-medium'); // 'October 17, 2026'
toSlug('Héllo, World! 2026'); // 'hello-world-2026'
```

Generate secure random values, IDs, and timestamps:

```ts
import { createTimestamp, generateRandomString, generateUUID } from 'jg-utils';

generateRandomString(16); // drawn with crypto.getRandomValues, fit for secrets
generateUUID(7); // a time-ordered UUID
createTimestamp(); // '2026-10-17T08:30:00.000Z'
```

Paginate with opaque cursors, and wait or retry with timing in seconds:

```ts
import { decodeCursor, encodeCursor, retryAsyncFunction, waitUntil } from 'jg-utils';

const cursor = encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id });
const continuation = decodeCursor(cursorFromClient); // throws INVALID_CURSOR for anything else

await retryAsyncFunction(() => fetchData(), [3, 5]); // retries after 3, then 5 seconds
await waitUntil(() => readStatus() === 'ready' || undefined, { timeoutSeconds: 30 });
```

## Coming from `web-utils-kit`

| `web-utils-kit`                           | `jg-utils`                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `import … from 'web-utils-kit'`           | `import … from 'jg-utils'`                                                     |
| `createDeepClone(value)`                  | `structuredClone(value)`                                                       |
| `expectToThrowCode`, `expectToRejectCode` | `import { expectToThrowCode, expectToRejectCode } from 'jg-exception/testing'` |
| `ERRORS.UNABLE_TO_CREATE_DEEP_CLONE`      | removed, along with `createDeepClone`                                          |

Changed behavior:

- `generateRandomString`, `generateRandomInteger`, `generateRandomFloat`, and `shuffleArray` draw from `crypto.getRandomValues` with rejection sampling instead of `Math.random`, so every result is equally likely and random strings are fit for secrets. Their signatures are unchanged.
- `isEqual` accepts any values: primitives, `null`, and `undefined` are compared with `Object.is`, and an object never equals a primitive. It used to throw `UNSUPPORTED_DATA_TYPE` for anything but objects and arrays.
- Errors are `Exception`s from `jg-exception`, so their codes are always strings.

New: `ERRORS`, `createTimestamp`, `encodeCursor` and `decodeCursor` (with the `INVALID_CURSOR` code), and the `ONE_SECOND_IN_MILLISECONDS` to `ONE_YEAR_IN_MILLISECONDS` constants.

## Documentation

The full API reference is at https://jg-packages.jesusgraterol.dev/packages/jg-utils/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-utils/LICENSE)
