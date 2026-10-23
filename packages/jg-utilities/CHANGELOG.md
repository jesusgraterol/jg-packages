# Changelog

## 1.7.1

### Fixed

- `createByteCache` copies bytes into new memory, with `new Uint8Array(bytes)`, where it used `bytes.slice()`, which for a Node.js `Buffer` is a view of the same memory: a `Buffer` passed to `set` stayed linked to the cached value, as did the copies `get` and a retention's `copyBytes` returned. What it returns is now always a `Uint8Array`, never a `Buffer`.

## 1.7.0

### Added

- `stringifyJsonDeterministically(value, { strict: true })`, which accepts only plain JSON data, such as a document a digest or a signature covers. It throws `UNABLE_TO_SERIALIZE_JSON`, naming the value's path, for undefined anywhere, NaN and ±Infinity, BigInts, symbols, functions, objects that aren't plain, symbol keys, holes, and cycles, and writes -0 as 0.
- `measureJsonBytes(value, maxBytes)`, the UTF-8 size of what `JSON.stringify` writes, measured without serializing and stopped once it passes the limit. It takes primitives too, descends at most 64 levels, and throws `UNABLE_TO_SERIALIZE_JSON` for a value JSON can't hold.
- `countUtf8Bytes(text, maxBytes?)`, a string's UTF-8 size as `TextEncoder` writes it, counted without encoding and stopped once it passes the limit.
- `compareCodePoints(left, right)`, an allocation-free comparison by Unicode code point, the order of UTF-8 bytes, for sorting.
- `isPortablePathValid(value, { maxComponentBytes?, maxPathBytes?, componentPattern? })`, which checks a relative path with `/` between its components for Windows, macOS, and Linux, with limits in UTF-8 bytes, and `findCaseFoldCollision(paths)`, the first two paths a filesystem that ignores case and Unicode normalization would see as one.
- `deepFreeze(value)`, which freezes every object a value holds, symbol keys and the children of frozen objects included, and is safe with cycles.
- `runInOrder(items, { concurrency, execute, commit? })`, which runs items at most `concurrency` at a time and commits their results one at a time, in the items' order, a worker starting its next item only after committing its previous one. The first failure stops new items, and the ones running finish uncommitted. A concurrency that isn't an integer of at least 1 throws `INVALID_CONCURRENCY_LIMIT`.
- `findMarkedRegion(text, markers)` and `upsertMarkedRegion(text, block, markers)`, for the part of a document a tool keeps up to date between two marker lines. They keep a byte order mark and the text around the region, follow the start marker line's LF or CRLF, append after a blank line when there's no region, and throw `INVALID_MARKED_REGION` for duplicate, misordered, or partial-line markers and a malformed block.
- `runWhileCurrent(run, { isCurrent, subscriptions, createStaleError, signal? })`, for work that belongs to a state that can change while it runs, such as a request for the signed-in account. A change that leaves it stale aborts it and makes it end in the stale error, whatever it does, and the caller's signal aborts it with its own reason.
- `createByteCache({ maxBytes, maxEntries? })`, a least-recently-used cache of bytes that copies them in and out, and whose `retain` pins an entry against eviction and replacement. Invalid limits throw `INVALID_BYTE_LIMIT`.
- `takeWithinByteBudget(items, { maxBytes, measurePage })`, the longest run of items whose page fits a byte budget, measuring each item once and reading the items lazily.
- `abortable(promise, { signal })`, which stops waiting for a promise when a signal aborts, with its reason.
- `isPrimaryClick(event)`, whether a DOM or React click is a plain primary click, and `escapeMarkdownInline(text)`, which escapes text for one line of Markdown.
- `IDeterministicJsonOptions`, `IPortablePathOptions`, `IRunInOrderOptions`, `IRegionMarkers`, `IMarkedRegion`, `IRunWhileCurrentOptions`, `IByteCache`, `IByteCacheOptions`, `IByteCacheRetention`, `ITakeWithinByteBudgetOptions`, and `IClickEvent`.

### Changed

- `stringifyJsonDeterministically` builds its text directly, ordering keys by UTF-16 code unit, as RFC 8785 does, so integer-like keys sort with the others instead of first. Sorting no longer takes quadratic time on large objects, and toJSON is called wherever `JSON.stringify` calls it.
- `isFileNameValid` refuses `COM¹`, `COM²`, `COM³`, `LPT¹`, `LPT²`, and `LPT³`, which Windows reserves like `COM1`.

## 1.6.0

### Changed

- Supports Node.js 22.17.0 and later, down from 24.

## 1.5.0

### Added

- `createTaskRunner({ onError })`, a runner for background tasks that a shutdown can drain. `run(task, { key?, ifBusy?, signal? })` starts a task now and passes its result or error through, after claiming its key, rejecting with `TASK_RUNNER_BUSY` while the key's task runs, or joining it with `ifBusy: 'join'`. `trigger(task, { key? })`, for timer ticks, skips a busy key, resolving to `false`, and sends a task's error to `onError`. `close({ abort?, reason? })` stops new tasks, which then reject with `TASK_RUNNER_CLOSED`, optionally aborts the runner's signal, which every task's signal follows, and resolves once every task settled. `isIdle(key?)` and `isClosing()` report its state.
- `createDeadline({ timeoutSeconds?, deadlineAt?, signal? })`, the earlier of a timeout and a time, with a signal that aborts with a `TimeoutError` at the deadline, which jg-fetch reads as a timeout, or with the caller's reason. `throwIfStopped()` reads the clock and throws the caller's reason or `DEADLINE_EXCEEDED`, `stopReason()` says which ended the work, `child({ timeoutSeconds })` bounds one step within the deadline, and `dispose()` stops its timer. A deadline days away works, and `deadlineAt: Infinity` sets none. Options that aren't valid throw `INVALID_DEADLINE`.
- `downloadBlob(blob, fileName, { revokeDelaySeconds? })`, which saves a Blob as a file in a browser through a temporary hidden link, revoking the object URL 40 seconds later by default, so the download isn't cancelled, and `downloadJson(value, fileName, { space? })`, which saves pretty JSON ending in a newline and throws `UNABLE_TO_SERIALIZE_JSON` for a value JSON can't hold. Both resolve to `false` without a document.
- `ITaskRunner`, `ITaskRunnerOptions`, `IRunTaskOptions`, `ICloseTaskRunnerOptions`, `IDeadline`, `IDeadlineOptions`, `IDeadlineStopReason`, `IDownloadBlobOptions`, and `IDownloadJsonOptions`.

## 1.4.0

### Added

- `redactUrlQueryParams(url, names)`, which removes a URL's query and fragment when the query holds any of the named parameters, such as a token, matching names after decoding and as array parameters, so the URL can be logged. A name that can't be decoded, or a URL that is only a query, gives `[redacted]`.
- `redactSecrets(text, { patterns?, replacement?, preserveLineBreaks? })`, which replaces complete PEM private key blocks, in one pass, and then every match of the token patterns, `SECRET_TOKEN_PATTERNS` by default: GitHub's tokens and `sk-` API keys. It returns the text and how many secrets it replaced, can keep a key's line breaks so line numbers stay the same, and never throws.
- `SECRET_TOKEN_PATTERNS`, `IRedactSecretsOptions`, and `IRedactSecretsResult`.
- `parseYouTubeVideoId(url)`, the id of the single video a youtu.be, youtube.com, m.youtube.com, or youtube-nocookie.com URL points at, or null for anything else, without throwing.
- `toYouTubeWatchUrl(videoId)` and `toYouTubeEmbedUrl(videoId)`, the canonical watch page and privacy-enhanced embed URLs. An id that isn't 11 letters, digits, `-`, or `_` throws `INVALID_YOUTUBE_VIDEO_ID`.
- `isYouTubeVideoIdValid(value)`.
- `createRequestCoordinator({ maxConcurrent, maxQueued })`, which runs tasks, such as requests to a rate-limited API, within a concurrency limit and a bounded first-in, first-out queue, with an optional cap per caller. `deferUntil(deadline)` starts a cooldown, such as from `Retry-After`, that queued tasks wait out without holding a slot, while tasks run with `rejectDuringCooldown` reject at once. An aborted signal takes a task out of the queue, `isIdle()` says when nothing runs, waits, or cools down, and `close()` rejects what's waiting. Invalid limits throw `INVALID_CONCURRENCY_LIMIT` or `INVALID_QUEUE_LIMIT`, and runs reject with `REQUEST_QUEUE_FULL`, `REQUEST_COOLDOWN_ACTIVE`, or `REQUEST_COORDINATOR_CLOSED`.
- `createCursorCodec({ schema, maxLength?, matchesScope? })`, a list's cursor codec: `encode` validates a continuation with the schema and encodes it, throwing `CURSOR_TOO_LONG` past `maxLength`, and `decode` accepts a cursor only when it decodes, fits the schema, and belongs to the list's scope, such as its filters, and otherwise throws `INVALID_CURSOR` with the reason in its data. A missing cursor decodes as the first page. Unlike `btoa`, it encodes text outside Latin-1.
- `ISchema`, `IRequestCoordinator`, `IRequestCoordinatorOptions`, `IRunRequestOptions`, `ICursorCodec`, and `ICursorCodecOptions`.
- A recipe for waiting out a rate limit across requests.

### Changed

- Depends on `jg-exception` 1.5.0, whose `REDACTED_VALUE` marks what the redaction functions remove.
- The recipe for paginating with cursors uses `createCursorCodec`, which checks each cursor's shape and filter.

## 1.3.0

### Added

- `toUtcDate(value?)`, the UTC calendar date of an instant as `YYYY-MM-DD`, now when no value is given. An invalid instant throws `INVALID_DATE` instead of a native `RangeError`.
- `getTrailingUtcDateRange(dayCount, value?)`, the inclusive range of the last `dayCount` UTC days ending on an instant's UTC date, and `generateUtcDateSequence(range)`, every date in such a range, oldest first. `INVALID_DAY_COUNT` and `INVALID_DATE_RANGE` reject a day count that isn't a positive safe integer and a range that isn't two real dates in order.
- `truncateToUtf8Bytes(text, maxBytes)`, the longest prefix of whole code points that fits a number of UTF-8 bytes. A limit that isn't a non-negative safe integer throws `INVALID_BYTE_LIMIT`.
- `createEventBus({ onError })`, a typed in-process event bus: `emit` returns at once, each event is delivered later in the order it was emitted, each handler runs on its own with its errors sent to `onError`, and `close()` drops pending deliveries.
- `IUtcDateRange`, `IEventBus`, and `IEventBusOptions`.

## 1.2.0

### Added

- `escapeHtml(text)`, which escapes `&`, `<`, `>`, `"`, and `'` so text can go into HTML.
- `pluralize(count, singular, plural?)`, which picks the word for a count, `singular + 's'` unless the plural is given.
- `resolveSafeInternalPath(candidate, excludedPaths?)`, which returns an untrusted path, such as a `returnTo` parameter, only when it stays on the same site and outside the excluded paths. It rejects absolute and protocol-relative URLs, backslashes, and paths that can't be decoded, and matches excluded paths by whole segments, case-insensitively and after decoding.
- `isBigIntStringValid(value, min?, max?)`, which accepts an integer written in plain decimal digits, as PostgreSQL returns a BIGINT, within a range that defaults to a signed 64-bit integer.

### Fixed

- `prettifyNumber` puts a negative value's sign before the prefix, so `-5` with the prefix `$` is `-$5` instead of `$-5`.

## 1.1.1

### Added

- `RECIPES.md`, patterns for apps that use the package: paginating with cursors, stable cache keys from JSON, and validating input at the edge. Each block is typechecked against the release.

### Fixed

- The `INVALID_AUTHORIZATION_HEADER` and `INVALID_EMAIL_ADDRESS` messages no longer repeat the header or the address they rejected, which could carry a credential or personal data into logs and API responses. The codes are unchanged.

## 1.1.0

A fresh start: breaking changes in a minor version, once, because nothing depended on 1.0.x.

### Added

- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.

### Changed

- Errors are `Exception`s from `jg-exception` 1.1.0: the code, the data, and the cause each have their own field, nothing is encoded into the message, and `toJSON()` and `toString()` follow `jg-exception`.
- `IJsonValue` is `jg-exception`'s, re-exported under the same name, so an object's values may also be `undefined`, which `JSON.stringify` drops.
- Names case acronyms as words, like every other name in the packages:
  - `IJSONValue` is `IJsonValue`, and `IUUIDVersion` is `IUuidVersion`
  - `parseJSON`, `stringifyJSON`, `stringifyJSONDeterministically`, and `pruneJSON` are `parseJson`, `stringifyJson`, `stringifyJsonDeterministically`, and `pruneJson`
  - `generateUUID` is `generateUuid`
  - `isJWTValid`, `isURLValid`, and `isUUIDValid` are `isJwtValid`, `isUrlValid`, and `isUuidValid`
- Error messages say what failed at that step and keep the error underneath as `cause`, instead of repeating its message, so `extractMessage` prints each layer of the chain once.

## 1.0.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 1.0.0.

## 1.0.0

The first release.

### Added

- Validations, such as `isEmailValid`, `isUUIDValid`, and `isEqual`, which compares any values.
- Transformers, such as `toSlug`, `createTimestamp`, `prettifyNumber`, and `encodeCursor` and `decodeCursor` for opaque pagination cursors.
- Generators, such as `generateUUID` and `generateRandomString`, and `shuffleArray`, which draw from `crypto.getRandomValues` with rejection sampling.
- Collection, sorting, async, and environment utilities, such as `pickProps`, `sortRecords`, `retryAsyncFunction`, and `hasWindow`.
- The `ONE_SECOND_IN_MILLISECONDS` to `ONE_YEAR_IN_MILLISECONDS` constants, and `ERRORS`, the codes of every error the package throws.
