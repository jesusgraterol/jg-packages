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
| Something whose identity matters           | a class                             | `new Exception(message, { code })`, `instanceof FetchException` |

Module state that a UI reads exposes `subscribe` and `getSnapshot` functions, so React's `useSyncExternalStore` can read it directly.

## Errors

Every package throws `Exception` from `jg-exception` and exports its codes as `ERRORS`, an `as const` map whose values are the codes themselves, so callers compare against it:

```ts
export const ERRORS = {
  INVALID_CURSOR: 'INVALID_CURSOR',
} as const;

throw new Exception('The cursor is not a valid encoded value.', {
  code: ERRORS.INVALID_CURSOR,
  data: { cursor },
  cause: error,
});

if (hasErrorCode(error, ERRORS.INVALID_CURSOR)) {
  // handle it
}
```

- **The constructor** is `new Exception(message, { code, data, cause })`. Nothing is encoded into the message: the code, the data, and the cause each have their own field.
- **Codes are strings**, `UPPER_SNAKE_CASE`, and stable: callers branch on them, so changing one is a breaking change. `getErrorCode` and `hasErrorCode` read a string `code` property from any error, including Node.js system errors such as `ENOENT`.
- **`UNKNOWN_ERROR_CODE`** (`'UNKNOWN_ERROR'`) is the code for an error that has none, such as when `jg-api-response` sends a plain `Error` to a client. Don't throw it yourself; give every error you throw its own code.
- **`data` is an `IJsonValue`**, context that helps whoever handles or debugs the error, such as the id that wasn't found. A `BigInt`, a `Date`, or a class instance is a type error. Object values may be `undefined`, so `{ email }` works when `email` is optional. An interface has no index signature, so pass an interface-typed value as `{ ...value }`, or declare its type with `type`. Never put secrets in it: it reaches clients.
- **The cause rule:** a message says what failed at this step, and `cause` holds the error underneath. Never write `extractMessage(cause)` into a message: `extractMessage` already joins the chain as `message; [CAUSE]: cause message`, so an embedded cause prints twice, and the layers can no longer be told apart.
- **`redact`:** when a cause may hold a value that logs mustn't, such as a token, a password, or a one-time code, pass it as `redact` where you wrap the cause. The exception's message, data, and whole cause chain are redacted as it's built, so nothing downstream has to remember to. [jg-exception's README](../packages/jg-exception/README.md#keeping-secrets-out-of-an-error) says what it costs.
- **`toJSON()`** returns `{ name, code, message, data }`, which `JSON.stringify` and `jg-api-response` use. Data that can't be serialized at runtime, such as an object that refers back to itself, becomes `null` there, as do `NaN` and `Infinity`, as in any JSON.

The message is written where the error is thrown, so it can name the value that failed, except a credential or personal data, such as an authorization header, a token, or an email address: say what's wrong with it instead, because messages reach logs and clients. Each function documents what it throws, one `- CODE: message` line per code, with the stable part of the message:

```ts
/**
 * …
 * @throws
 * - INVALID_CURSOR: The cursor is not a valid encoded value.
 */
```

## Checking data

Every option that validates data from outside the program, such as a response, a stored record, or a file, is named `schema`, with the same structural type:

```ts
export type ISchema<T> = {
  parse(value: unknown): T;
};
```

- A Zod schema satisfies it, and so does any validator with that method. Each package declares the type itself instead of importing it from another package.
- The data's type comes from the schema. Without one, it's `unknown`, unless the caller passes a type argument.
- The schema's own error, such as a `ZodError`, propagates unchanged from a function that throws. A function that never throws, such as jg-fetch's `request`, returns its own error code with the schema's error as `cause`.
- Each package that takes a schema has a contract test that runs a real Zod schema, for the valid case and the failing one.

## What to test

Test by risk, not by a coverage percentage, with the [categories in `development.md`](development.md#tests):

- **Every behavior a caller relies on,** with unit tests, and integration tests for anything that touches the filesystem, processes, or the network, against a temporary directory or a local server. Test the failure paths too: each `@throws` line is a behavior.
- **Every error code,** asserted in a test, which release check 9 enforces: `expectToThrowCode(…, ERRORS.X)`, or `code: ERRORS.X` in a matcher.
- **Examples,** which release check 8 typechecks, and runs for the packages without I/O. State results with `// =>` rather than repeating them in tests.
- **Contracts between packages,** with the real packages on both sides, such as an envelope built by `jg-api-response` and read by `jg-fetch`, or a real Zod schema in every `schema` option.
- **Types,** with `expectTypeOf` inside unit tests, only where generics or overloads decide a type, such as `request`'s data by `parseAs` and `schema`.
- **Properties,** with `fast-check`, only where the inputs are endless, such as round trips, rounding, or a function that must never throw. Keep most generated cases valid enough to reach the interesting code, and assert that they do.
- **Browser APIs,** with `.test-browser.ts` files, which run in Chromium, Firefox, and WebKit, because engines differ there. Everything else runs in Node.js.
- **Coverage** finds what the tests missed. Every uncovered branch gets a test or is deleted as dead code, unless a test can't reach it, such as a Windows-only path or a fallback the type checker requires, and each published package's thresholds keep what was measured.

Don't test what can't break on its own: re-exports, constants, types without generics, or behavior a contract test already proves.

## Naming

- Exported types are `IPascalCase`, constants are `UPPER_SNAKE_CASE`, and functions and variables are `camelCase`.
- Names case acronyms as words: `createIndexedDbStore`, `IHttpMethod`, `readJsonFile`, `isUrlValid`. The one exception is `toJSON`, the method name `JSON.stringify` calls.
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
- **Examples are code a reader can paste.** `release:verify` typechecks every one against the published tarballs, so each example:
  - imports what it uses from the package, by its public name, such as `import { toSlug } from 'jg-utilities';`, and from Node.js or other packages the same way
  - defines its inputs, such as `const csv = 'id,name\n1,Ada\n';`. Where an input is the reader's own, such as a button or a token getter, it's declared in the package's `examples.d.ts`, which never ships: `declare const button: HTMLButtonElement;`
- **Results are stated with `// =>`.** In `jg-exception`, `jg-api-response`, `jg-utilities`, and `jg-bignumber`, which do no I/O, every example also runs, in en-US and UTC, and each top-level `expression; // => result` line becomes an assertion, so the stated result is checked. These examples therefore can't throw, and can't use what `examples.d.ts` declares, because it doesn't exist at runtime: define the inputs instead. `// =>` marks only deterministic results; describe anything else in a plain comment, such as `generateUuid(4); // such as '9b1deb4d-…'`. The other packages' examples, which do I/O, are typechecked only, so they describe results with plain comments.
- The README has these sections, in order:
  1. the package name as the title, then a one-sentence summary
  2. `## Install`
  3. `## Usage`
  4. `## Documentation`: that the API reference ships as `API.md` and the recipes as `RECIPES.md`, with links to the package's pages on the site
  5. `## License`
- README links are absolute URLs, because the README is also the package's npm page. There's no hand-written API reference: every build renders `API.md` from the TSDoc, which ships in the tarball, so an agent reads the reference of the installed version in `node_modules/<package>/API.md`, and the site shows the same reference.

## Recipes

Each package without Astro components ships a `RECIPES.md`: app-side patterns, the jobs an app does with the package that its API reference can't show, such as one error handler for every route, or a typed client for an envelope API. The site shows them on the package's recipes page.

- **The format:** the title `# <name> recipes`, one sentence on what they show, then one `## <recipe>` section per recipe, with prose and at least one ` ```ts ` block. Two to four recipes; one that needs many blocks is better as two.
- **Each block is self-contained,** like an example: it imports what it uses by its public name, and declares the reader's own inputs, in the package's `examples.d.ts` when several blocks share them.
- **Typechecked, not run,** because recipes show app code that does I/O. `release:verify` typechecks every block against the release, so a recipe can't drift from the API. Describe results in comments: `// =>` isn't used in recipes.
- **Framework-free:** a handler is a plain function, such as `(error: unknown) => { status: number; body: IApiResponse<null> }`, that fits Express, Hono, or anything else, so no framework's types enter the checks.
- **When to add one:** when apps combine a capability with their own code in a way an example can't show, or when the same question about using the package comes up twice. Change a recipe in the same change as the API it shows. `RECIPES.md` ships, so a change to it needs a version bump, like any other shipped file.

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

## Keeping jg-skills in sync

[jg-skills](https://github.com/jesusgraterol/jg-skills) connects projects to these packages in two parts: the `jg-packages` skill, which tells an agent which package fits a task, and its policy asset, the `## jg-packages` section projects add to their `AGENTS.md`. Each package's docs own its API, the policy asset owns the policy, and the skill owns which package fits which task. Nothing syncs them automatically, so a change here checks them by hand.

Whenever a listed package is added, renamed or removed, or changes a capability, a runtime, an entry point, a cross-package contract, where its docs live, or a version jg-skills names:

1. Check what in jg-skills refers to it: `skills/jg-packages/SKILL.md`, with its package map and the version bullet that names the versions it was written for; the policy asset, `skills/jg-packages/assets/agents-section.md`; the coding-instructions candidate's skill index; and the jg-skills site's descriptions.
2. Record the jg-skills change that matches, in the pull request or the release notes, or say why none is needed. An internal change that leaves the guidance accurate needs no edit.
3. Remove any recommendation of something removed or renamed. Advance the skill's version bullet only after reviewing the guidance it covers.
4. Make the jg-skills change with that repository's own checks, in `docs/skill-guidelines.md`, and its protected-instructions handoff, which never edits the canonical instructions directly.

When the access or the authorization to change jg-skills is missing, report the exact work left to do there instead of calling it done.
