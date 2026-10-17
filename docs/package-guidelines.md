# Package guidelines

The conventions every published `jg-*` package follows. A change to one of these rules updates this file in the same pull request.

## Exports

Every package is ESM only (`"type": "module"`). `exports` declares every entry point, with `types` first and `default` last, and keeps `main` and `types` as fallbacks for older tools:

```json
{
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
    "./sync": { "types": "./dist/sync/index.d.ts", "default": "./dist/sync/index.js" }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts"
}
```

- No wildcard subpaths, such as `"./*": "./dist/*"`, so internals never become public.
- Nothing runs when a module loads: no `window` or `navigator` access, no listeners, no global configuration, and no I/O at import time. State is created by the first call that needs it.
- No default exports and no `export *`. Exports sit on their declarations, and `index.ts` files only re-export, naming each symbol and grouping them by owning file:

  ```ts
  // types
  export type { IStoreOptions, ISyncStore } from './types.js';

  // factories
  export { createLocalStore } from './local-store.js';
  ```

## Export style follows usage

| What the code is                           | How it's exported                   | Example                                                         |
| ------------------------------------------ | ----------------------------------- | --------------------------------------------------------------- |
| Stateless logic                            | named functions                     | `isEqual(a, b)`                                                 |
| One piece of browser state per page        | module state behind named functions | `registerServiceWorker()`, `subscribeToServiceWorker(listener)` |
| Something a consumer creates several times | a `create*` factory                 | `createLocalStore<T>('settings')`                               |
| Something whose identity matters           | a class                             | `new Exception(message, code)`, `instanceof FetchException`     |

Module state that a UI reads exposes `subscribe` and `getSnapshot` functions, so React's `useSyncExternalStore` can read it directly.

## Errors

Every package throws `Exception` from `jg-exception` and exports its codes as `ERRORS`, an `as const` map whose values are the codes themselves, so callers compare against it:

```ts
export const ERRORS = {
  INVALID_CURSOR: 'INVALID_CURSOR',
} as const;

throw new Exception(
  `The cursor is not a valid encoded value: ${extractMessage(error)}`,
  ERRORS.INVALID_CURSOR,
);

if (hasErrorCode(error, ERRORS.INVALID_CURSOR)) {
  // handle it
}
```

The message is written where the error is thrown, so it can name the value that failed. Each function documents what it throws, one `- CODE: message` line per code, with the stable part of the message:

```ts
/**
 * …
 * @throws
 * - INVALID_CURSOR: The cursor is not a valid encoded value.
 */
```

## Naming

- Exported types are `IPascalCase`, constants are `UPPER_SNAKE_CASE`, and functions and variables are `camelCase`.
- New names case acronyms as words: `createIndexedDbStore`, `IHttpMethod`, `parseRetryAfterMs`. Names that carry over from the old packages keep their spelling, such as `writeJSONFile`.
- Timing options are in seconds, and every option or field with a unit names it: `timeoutSeconds`, `retryDelaysSeconds`. Measured output uses the unit it's measured in, such as `durationMs`.

## Runtimes

Each package says which runtimes it supports, and typechecks against only their globals:

| Runtime   | Typechecked with                    | Can use                                           |
| --------- | ----------------------------------- | ------------------------------------------------- |
| Universal | both `browser.json` and `node.json` | only globals both have, such as `fetch`, `crypto` |
| Browser   | `browser.json`                      | the DOM                                           |
| Node.js   | `node.json`                         | Node.js built-ins, imported as `node:…`           |

A package with entries for different runtimes typechecks each entry's directory against its own runtime.

## Documentation

- Every exported function and class has a TSDoc summary and at least one `@example`. Exported types and constants have a summary.
- Error contracts follow the `@throws` format under [Errors](#errors).
- The README has these sections, in order:
  1. the package name as the title, then a one-sentence summary
  2. `## Install`
  3. `## Usage`
  4. `## Coming from <old package>`: a table of every removed or renamed symbol with its replacement, and every changed behavior. A package without a predecessor leaves it out.
  5. `## Documentation`: a link to the package's page on the site
  6. `## License`
- README links are absolute URLs, because the README is also the package's npm page. There's no hand-written API reference: the site generates it from the TSDoc.

## Changelogs

`CHANGELOG.md` has one `## <version>` section per release, newest first, with `### Added`, `### Changed`, `### Deprecated`, `### Removed`, and `### Fixed` subsections as needed:

```markdown
## 1.1.0

### Added

- `decodeCursor` accepts a `maxLength`.
```

## Tests

- Tests sit next to the file they test, named after it with their category suffix, such as `utilities.test-unit.ts`.
- Tests never use the network. Code that makes requests is tested against a local `node:http` server.
- Tests that touch the filesystem work inside their own `mkdtemp` directory and remove it afterwards.
- Test files never ship: the build compiles `src` without them, and the published file list is checked.

## Keeping the docs current

A change to a process, script, check, or convention updates the doc that describes it in the same pull request.
