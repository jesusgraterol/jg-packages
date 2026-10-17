# jg-utilities

Validations, transformers, generators, and collection, async, and environment utilities for browsers and Node.js.

## Install

```bash
npm install jg-utilities
```

## Usage

Validate input before using it:

```ts
import { isEmailValid, isIntegerValid, isStringValid } from 'jg-utilities';

isStringValid(name, 1, 100); // a non-blank string of 1 to 100 characters
isIntegerValid(page, 1); // an integer of at least 1
isEmailValid(email); // a valid address without a forbidden extension
```

Format values for people:

```ts
import { prettifyDate, prettifyFileSize, prettifyNumber, toSlug } from 'jg-utilities';

prettifyNumber(1234567.891); // '1,234,567.89'
prettifyFileSize(1536); // '1.50 kB'
prettifyDate(createdAt, 'date-medium'); // 'October 17, 2026'
toSlug('Héllo, World! 2026'); // 'hello-world-2026'
```

Generate secure random values, IDs, and timestamps:

```ts
import { createTimestamp, generateRandomString, generateUUID } from 'jg-utilities';

generateRandomString(16); // drawn with crypto.getRandomValues, fit for secrets
generateUUID(7); // a time-ordered UUID
createTimestamp(); // '2026-10-17T08:30:00.000Z'
```

Paginate with opaque cursors, and wait or retry with timing in seconds:

```ts
import { decodeCursor, encodeCursor, retryAsyncFunction, waitUntil } from 'jg-utilities';

const cursor = encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id });
const continuation = decodeCursor(cursorFromClient); // throws INVALID_CURSOR for anything else

await retryAsyncFunction(() => fetchData(), [3, 5]); // retries after 3, then 5 seconds
await waitUntil(() => readStatus() === 'ready' || undefined, { timeoutSeconds: 30 });
```

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-utilities/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-utilities/LICENSE)
