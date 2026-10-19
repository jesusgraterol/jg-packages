# Creating a package

Every step to add a new `jg-*` package, from choosing its name to its first release. Follow them in order; each one ends with what you should see. The conventions the code follows are in [`package-guidelines.md`](package-guidelines.md).

## 1. Choose the name

Packages are named `jg-<name>`, with a short, lowercase `<name>`, such as `jg-utilities`. Check that npm has neither the name nor the same name without punctuation, because npm rejects names that differ from an existing package only by `-`, `.`, or `_`:

```bash
npm view jg-<name> name
npm view jg<name> name
```

Both should fail with `npm error code E404`.

npm also rejects a name too close to a popular package, and only says so when you publish. Any other prefix of one or two characters counts: `jg-utils` was refused for its likeness to `xe-utils` (about 53,000 weekly downloads), then `jg-toolkit` for `es-toolkit`, and the package became `jg-utilities`. `jg-git` was refused for `cz-git` (about 71,000) and `jg-docker` for `is-docker` (about 81 million), and they became `jg-git-commands` and `jg-local-docker`. List the most downloaded names that differ only in the prefix:

```bash
node --input-type=module - <name> <<'EOF'
const name = process.argv[2];
const chars = [...'abcdefghijklmnopqrstuvwxyz0123456789'];
const names = [...chars.flatMap((a) => chars.map((b) => `${a}${b}-${name}`)), ...chars.map((a) => `${a}-${name}`)];
const downloads = {};
for (let i = 0; i < names.length; i += 128) {
  const response = await fetch(`https://api.npmjs.org/downloads/point/last-week/${names.slice(i, i + 128).join(',')}`);
  for (const [pkg, value] of Object.entries(await response.json())) downloads[pkg] = value?.downloads ?? 0;
}
console.log(Object.entries(downloads).sort((a, b) => b[1] - a[1]).slice(0, 3));
EOF
```

Every accepted name's neighbors stayed under about 4,000 weekly downloads. Pick another name when one has tens of thousands.

## 2. Choose the runtime

| Runtime   | The code runs in     | Typechecked with                                      |
| --------- | -------------------- | ----------------------------------------------------- |
| Universal | browsers and Node.js | `tsconfig.json` (Node.js) and `tsconfig.browser.json` |
| Browser   | browsers and workers | `tsconfig.json` and `tsconfig.browser.json`           |
| Node.js   | Node.js              | `tsconfig.json`                                       |

A package with entries for different runtimes, such as a browser runtime and a Node.js build tool, typechecks each entry's directory with its own configuration.

## 3. Create the directory and its files

Create `packages/jg-<name>/` with this layout:

```text
packages/jg-<name>/
├── src/
│   └── index.ts              # re-exports the public API; each module lives in its own directory
├── CHANGELOG.md
├── LICENSE                   # a copy of the repository's LICENSE
├── README.md
├── RECIPES.md                # app-side patterns; a package with Astro components has none
├── eslint.config.js
├── package.json
├── tsconfig.json             # editor and typecheck: src, tests, and config files
├── tsconfig.build.json       # emit: src without tests
├── tsconfig.browser.json     # universal and browser packages only
├── vitest.config.ts
└── examples.d.ts             # only when examples use inputs they don't define; never ships
```

### `package.json`

```json
{
  "name": "jg-<name>",
  "version": "1.0.0",
  "description": "<one sentence, between 70 and 160 characters>",
  "author": "Jesus Graterol",
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "CHANGELOG.md", "API.md", "RECIPES.md"],
  "sideEffects": false,
  "engines": {
    "node": ">=24"
  },
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/jesusgraterol/jg-packages.git",
    "directory": "packages/jg-<name>"
  },
  "homepage": "https://jg-packages.jesusgraterol.dev/packages/jg-<name>/",
  "bugs": {
    "url": "https://github.com/jesusgraterol/jg-packages/issues"
  },
  "scripts": {
    "build": "node ../../internal/build-tools/src/clean-dist.ts && tsc -p tsconfig.build.json && node ../../internal/api-reference/src/write-api-markdown.ts",
    "lint": "eslint .",
    "test": "pnpm test:unit",
    "test:coverage": "vitest run --coverage --project unit",
    "test:unit": "vitest run --project unit",
    "typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.browser.json"
  },
  "dependencies": {
    "jg-exception": "workspace:^"
  },
  "devDependencies": {
    "@jg-packages/eslint-config": "workspace:*",
    "@jg-packages/tsconfig": "workspace:*",
    "@jg-packages/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "@vitest/coverage-v8": "catalog:",
    "eslint": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

| Field             | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`         | `1.0.0` for a package with a stable API, or `0.1.0` while its API may still change.                                                                                                                                                                                                                                                                                                                                                                                             |
| `exports`         | One entry per subpath, `types` first and `default` last. Add `./sync`-style subpaths the same way, and nothing with a `*`.                                                                                                                                                                                                                                                                                                                                                      |
| `main`, `types`   | Fallbacks for tools that don't read `exports`.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `files`           | Everything that ships besides `package.json`, `README.md`, and `LICENSE`, which npm always includes. `CHANGELOG.md`, `API.md`, and `RECIPES.md` must be listed.                                                                                                                                                                                                                                                                                                                 |
| `sideEffects`     | `false` when nothing runs at import time, which the guidelines require. List stylesheets instead when the package ships CSS.                                                                                                                                                                                                                                                                                                                                                    |
| `publishConfig`   | Publishes unscoped packages publicly.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `repository`      | `directory` points npm and provenance at the package inside the monorepo.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `scripts`         | `build` cleans `dist` first, so stale files never ship, and ends by writing `API.md` from the TSDoc. Add `test:integration`, `test:browser`, `test:e2e`, and `test:bench` only when those tests exist, and keep `test` running unit, integration, browser, and end-to-end, in that order. `test:coverage` runs the unit and integration projects the package has, and `pnpm check` runs it instead of them. Drop `tsconfig.browser.json` from `typecheck` for Node.js packages. |
| `dependencies`    | Siblings use `workspace:^`. Other runtime dependencies use caret ranges, such as `^11.1.5`. A package that throws depends on `jg-exception`.                                                                                                                                                                                                                                                                                                                                    |
| `devDependencies` | Internal packages use `workspace:*`; shared tools use `catalog:`.                                                                                                                                                                                                                                                                                                                                                                                                               |

Add `bin` for a command-line tool, and `peerDependencies` (with `peerDependenciesMeta` for optional ones) only for what the consumer must provide. A command must exit 0 on `--help`, because the release checks run it.

When the package ships files the compiler doesn't emit, such as templates, copy them into `dist` at the end of `build`, with a glob relative to `src`:

```json
"build": "node ../../internal/build-tools/src/clean-dist.ts && tsc -p tsconfig.build.json && node ../../internal/build-tools/src/copy-assets.ts 'build/templates/*.sw.js'"
```

### TypeScript configurations

`tsconfig.json`, for the editor and the Node.js typecheck of the sources, tests, and config files:

```json
{
  "extends": "@jg-packages/tsconfig/node.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src", "*.config.ts"]
}
```

For a browser package, extend `@jg-packages/tsconfig/browser.json` instead and add `"types": ["node"]`, because the tests and config files still run in Node.js.

`tsconfig.build.json`, which emits `dist` from the sources only:

```json
{
  "extends": ["@jg-packages/tsconfig/node.json", "@jg-packages/tsconfig/library.json"],
  "include": ["src"],
  "exclude": ["src/**/*.test-*.ts"]
}
```

For a browser package, extend `@jg-packages/tsconfig/browser.json` instead of `node.json`.

`tsconfig.browser.json`, for universal and browser packages, which checks the sources against browser globals only:

```json
{
  "extends": "@jg-packages/tsconfig/browser.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test-*.ts"]
}
```

### A package with React components

- **Files.** Components live in `.tsx` files, and their tests are `.tsx` too, such as `page-outlet.component.test-browser.tsx`. Hooks and helpers stay `.ts`.
- **TypeScript.** All three configurations set `"jsx": "react-jsx"`. `tsconfig.build.json` and `tsconfig.browser.json` exclude `src/**/*.test-*`, because `src/**/*.test-*.ts` misses `.tsx` tests and would ship them.
- **Dependencies.** `react` is a peer dependency with a caret range, plus anything the components render through, such as `react-router`. The devDependencies add them at the tested versions, along with `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react`, and `@testing-library/dom` from the catalog. `release:verify` installs the `@types/react` version the package lists, so its JSX recipes typecheck.
- **Examples and recipes.** TSDoc examples are typechecked as `.ts`, so they build elements with `createElement`. Recipes can use ` ```tsx ` blocks.
- **Coverage.** Components that only run in a browser count towards coverage through the browser project's Chromium instance, as [the development guide](development.md#tests) describes: `test:coverage` adds `--project "browser (chromium)"` to the unit project, or runs only that instance when the package has no unit tests.

### Lint and test configurations

`eslint.config.js`:

```js
import { createEslintConfig } from '@jg-packages/eslint-config';

export default createEslintConfig({ rootDirectory: import.meta.dirname });
```

A package that ships classic service worker scripts lists them in `serviceWorkerFiles`, so they're linted with the service worker globals instead of Node.js's:

```js
export default createEslintConfig({
  rootDirectory: import.meta.dirname,
  serviceWorkerFiles: ['src/build/templates/*.sw.js'],
});
```

`vitest.config.ts`, listing only the categories the package has:

```ts
import { createVitestConfig } from '@jg-packages/vitest-config';

export default createVitestConfig({ categories: ['unit', 'integration'] });
```

### `README.md`

````markdown
# jg-<name>

<The same sentence as the package description.>

## Install

```bash
npm install jg-<name>
```

## Usage

<The two or three things most people do with it, as short examples.>

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-<name>/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-<name>/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-<name>/LICENSE)
````

Every link is absolute, because the README is also the package's npm page.

### `RECIPES.md`

Two to four recipes, as [the guidelines](package-guidelines.md#recipes) describe. A package with Astro components has none.

````markdown
# jg-<name> recipes

<One sentence on what the recipes show.>

## <A job an app does with the package>

<When you'd use it, in a sentence or two.>

```ts
import { <what it uses> } from 'jg-<name>';

// <the reader's own input, such as a request or a button>
declare const <input>: <its type>;

<the app code>
```

<What matters about it, such as a failure mode or a tradeoff, when there's something to say.>
````

### `CHANGELOG.md`

```markdown
# Changelog

## 1.0.0

### Added

- <What the first version offers.>
```

Expected result: `pnpm install` from the repository root links the new package, with no errors.

## 4. Write the source

Follow [`package-guidelines.md`](package-guidelines.md):

- One directory per module under `src/`, each with an `index.ts` that only re-exports, and `types.ts`, `constants.ts`, and `utilities.ts` as needed.
- Errors are `Exception`s from `jg-exception`, with the codes exported as `ERRORS`.
- Every export has TSDoc: a summary on everything, and an `@example` on functions and classes. Types and constants use a `//` comment.
- Every example imports what it uses and defines its inputs, as [the guidelines](package-guidelines.md#documentation) describe. When an example needs an input that belongs to the reader, such as a button, declare it in `examples.d.ts` at the package root, which `release:verify` adds when it typechecks the examples, and which never ships.
- Nothing runs at import time.

## 5. Write the tests

Put each test next to the file it tests, named after it with its category, such as `utilities.test-unit.ts`. Use integration tests for anything that touches the filesystem, processes, or the network, against a temporary directory or a local server. Use browser tests, `.test-browser.ts`, or `.test-browser.tsx` for a `.tsx` file, for behavior only a real browser has, such as storage or the clipboard: they run in Chromium, Firefox, and WebKit, with a `test:browser` script, `vitest run --project browser`. List each category you add in `vitest.config.ts`, give it a script, and keep `test:coverage` listing the unit and integration projects, plus the browser project's Chromium instance for code that only runs in a browser.

Expected result: `pnpm --filter jg-<name> test` passes.

## 6. List it on the website

Every listed package needs an entry in `website/src/site.config.ts`, with an icon chosen as [`website.md`](website.md#package-icons) describes, and a `"jg-<name>": "workspace:*"` devDependency in `website/package.json`, so the site rebuilds when the package changes. A package that should stay off the site goes in `UNLISTED_PACKAGES` instead. [`website.md`](website.md#listing-a-new-package) has the details.

## 7. Run every check

```bash
pnpm install
pnpm turbo run lint typecheck test:unit build --filter=jg-<name>
pnpm check
pnpm release:verify
```

Expected result: `pnpm release:verify` prints `PASS jg-<name>@<version>`. It packs the package, checks the files it ships, installs it into a temporary project and imports every subpath, runs publint and attw, and fails on any export without TSDoc. [`releasing.md`](releasing.md) describes each check.

## 8. Release it

Publish its first version by hand, following [the first publish](releasing.md#the-first-publish-of-a-new-package) in `releasing.md`. CI publishes every later version.

## Checklist

- [ ] The name and its punctuation-free form are free on npm.
- [ ] `package.json` has `exports` with `types` first, `files` with `CHANGELOG.md`, `API.md`, and `RECIPES.md`, a `build` that ends with `write-api-markdown.ts`, `sideEffects`, `engines`, `publishConfig`, and `repository.directory`.
- [ ] The TypeScript, ESLint, and Vitest configurations match the runtime.
- [ ] Every export has TSDoc, and every function and class an `@example`.
- [ ] The tests sit next to their files, and each category has a script.
- [ ] The README has its sections in order, and the changelog has a section for the version.
- [ ] `RECIPES.md` has two to four recipes, each with a ` ```ts ` or ` ```tsx ` block that typechecks, unless the package has Astro components.
- [ ] The package is listed on the website with its own icon, or marked unlisted.
- [ ] jg-skills is checked for the new package, as [Keeping jg-skills in sync](package-guidelines.md#keeping-jg-skills-in-sync) describes.
- [ ] `pnpm check` and `pnpm release:verify` pass.
