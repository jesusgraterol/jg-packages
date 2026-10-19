# jg-utilities

Validations, transformers, generators, and collection, async, and environment utilities for browsers and Node.js.

## Install

```bash
npm install jg-utilities
```

## Usage

Validate input before using it:

```ts
import { isBigIntStringValid, isEmailValid, isIntegerValid, isStringValid } from 'jg-utilities';

isStringValid(name, 1, 100); // a non-blank string of 1 to 100 characters
isIntegerValid(page, 1); // an integer of at least 1
isEmailValid(email); // a valid address without a forbidden extension
isBigIntStringValid(id, 1n); // a positive integer string that fits PostgreSQL's BIGINT
```

Format values for people:

```ts
import {
  escapeHtml,
  pluralize,
  prettifyDate,
  prettifyFileSize,
  prettifyNumber,
  toSlug,
} from 'jg-utilities';

prettifyNumber(1234567.891); // '1,234,567.89'
prettifyNumber(-5, { prefix: '$' }); // '-$5'
prettifyFileSize(1536); // '1.50 kB'
prettifyDate(createdAt, 'date-medium'); // 'October 17, 2026'
toSlug('Héllo, World! 2026'); // 'hello-world-2026'
`${count} ${pluralize(count, 'file')}`; // '1 file', '3 files'
escapeHtml(name); // safe to put into HTML, such as an email's body
```

Send someone back where they were after signing in, only within the site and never back to the sign-in page:

```ts
import { resolveSafeInternalPath } from 'jg-utilities';

const returnTo = resolveSafeInternalPath(searchParams.get('returnTo'), ['/sign-in']) ?? '/';
```

Keep secrets out of logs, and read the YouTube links people paste:

```ts
import {
  parseYouTubeVideoId,
  redactSecrets,
  redactUrlQueryParams,
  toYouTubeEmbedUrl,
} from 'jg-utilities';

redactUrlQueryParams(request.url, ['token']); // the path alone when the query holds a token
redactSecrets(logLine).text; // GitHub tokens, sk- keys, and private keys become [redacted]

const videoId = parseYouTubeVideoId(pastedUrl); // the id, or null for anything but one video
const embedUrl = videoId === null ? undefined : toYouTubeEmbedUrl(videoId);
```

Generate secure random values, IDs, and timestamps:

```ts
import { createTimestamp, generateRandomString, generateUuid } from 'jg-utilities';

generateRandomString(16); // drawn with crypto.getRandomValues, fit for secrets
generateUuid(7); // a time-ordered UUID
createTimestamp(); // '2026-10-17T08:30:00.000Z'
```

Work with UTC calendar dates, such as the days a report covers, and fit text into a byte budget, such as a push notification's payload limit:

```ts
import {
  generateUtcDateSequence,
  getTrailingUtcDateRange,
  toUtcDate,
  truncateToUtf8Bytes,
} from 'jg-utilities';

toUtcDate(createdAt); // '2026-10-17', the UTC day of an instant
const range = getTrailingUtcDateRange(30); // the last 30 UTC days, today included
generateUtcDateSequence(range); // one 'YYYY-MM-DD' per day, oldest first
truncateToUtf8Bytes(body, 2048); // whole code points only, at most 2048 bytes in UTF-8
```

Run side effects away from the code that triggers them with an in-process event bus:

```ts
import { createEventBus } from 'jg-utilities';

type IAppEvents = { userSignedUp: { userId: string } };

const events = createEventBus<IAppEvents>({ onError: (error) => logger.error(error) });
events.subscribe('userSignedUp', ({ userId }) => sendWelcomeEmail(userId));
events.emit('userSignedUp', { userId }); // returns at once; each handler runs later, on its own
```

Paginate with opaque cursors, and wait or retry with timing in seconds:

```ts
import { decodeCursor, encodeCursor, retryAsyncFunction, waitUntil } from 'jg-utilities';

const cursor = encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id });
const continuation = decodeCursor(cursorFromClient); // throws INVALID_CURSOR for anything else

await retryAsyncFunction(() => fetchData(), [3, 5]); // retries after 3, then 5 seconds
await waitUntil(() => readStatus() === 'ready' || undefined, { timeoutSeconds: 30 });
```

Give each list a cursor codec that validates its cursors and accepts them only for the filters they were made for, and keep a rate-limited API's requests within its limits:

```ts
import { createCursorCodec, createRequestCoordinator } from 'jg-utilities';

const paymentCursors = createCursorCodec({ schema: PaymentCursorSchema }); // a Zod schema, say
const after = paymentCursors.decode(request.query.cursor, { status }); // INVALID_CURSOR otherwise

const github = createRequestCoordinator({ maxConcurrent: 4, maxQueued: 64 });
const issues = await github.run(() => fetchIssues(), {
  caller: installationId,
  maxQueuedForCaller: 8,
});
github.deferUntil(retryAt); // queued requests wait out a Retry-After, without holding a slot
```

Run a service's background passes through a task runner, so a shutdown waits for them, and bound a job with a deadline:

```ts
import { createDeadline, createTaskRunner } from 'jg-utilities';

const runner = createTaskRunner({ onError: (error, { key }) => logger.error(key, error) });
const interval = setInterval(() => {
  void runner.trigger((signal) => syncInvoices(signal), { key: 'invoices' }); // skipped while one runs
}, 60_000);
const report = await runner.run(() => buildReport(), { key: 'report', ifBusy: 'join' }); // one at a time

// at shutdown: no new tasks, the running ones aborted, and resolved once they all settle
clearInterval(interval);
await runner.close({ abort: true });

const deadline = createDeadline({ timeoutSeconds: 55, signal: request.signal });
try {
  for (const file of files) {
    deadline.throwIfStopped(); // the request's reason, or DEADLINE_EXCEEDED once 55 seconds passed
    await uploadFile(file, deadline.signal); // aborts with a TimeoutError at the deadline
  }
} finally {
  deadline.dispose();
}
```

`run` claims its `key` before the task awaits anything, and another `run` with the key rejects with `TASK_RUNNER_BUSY`, or, with `ifBusy: 'join'`, resolves to the running task's result. `close` makes later runs reject with `TASK_RUNNER_CLOSED` and later triggers resolve to `false`, and never rejects. A deadline's `child({ timeoutSeconds })` bounds one step within it, and `stopReason()` says whether the caller's signal, `'cancelled'`, or the deadline, `'deadline'`, ended the work.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-utilities/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-utilities/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-utilities/LICENSE)
