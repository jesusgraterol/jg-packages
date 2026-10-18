# Development

How to set up the repository, run its checks, and change its dependencies.

## Requirements

- Node.js 24 or later. CI checks the latest LTS release and also runs the package tests on Node.js 24.0.0, the lowest version the packages support.
- pnpm. The root `package.json` pins it with `packageManager`, and pnpm switches itself to that version the first time you run it in the repository.

## Setup

1. Clone the repository and install:

   ```bash
   git clone git@github.com:jesusgraterol/jg-packages.git
   cd jg-packages
   pnpm install
   ```

   The install should finish without warnings about ignored build scripts.

2. Install the browsers Playwright runs the browser and end-to-end tests in: Chromium, Firefox, and WebKit:

   ```bash
   pnpm --filter jg-sw exec playwright install chromium firefox webkit
   ```

   On Linux, run `sudo pnpm --filter jg-sw exec playwright install-deps chromium firefox webkit` the first time, to install the system libraries they need. WebKit needs some that a desktop rarely has, such as `libevent-2.1-7t64`, `libavif16`, and `libmanette-0.2-0`.

3. Run every check once:

   ```bash
   pnpm check
   ```

   It should end with a `PASS <name>@<version>` line for every package.

## Commands

Run these from the repository root.

| Command             | What it does                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check`        | Lint, typecheck, build, the unit and integration tests with coverage, the browser and end-to-end tests, the format check, then `pnpm release:verify`.  |
| `pnpm build`        | Builds every package in dependency order.                                                                                                              |
| `pnpm dev`          | Serves the website at `http://localhost:4321/`, after building the packages it shows, and reloads it as you edit; [`website.md`](website.md) has more. |
| `pnpm lint`         | Runs ESLint in every package.                                                                                                                          |
| `pnpm typecheck`    | Typechecks every package against each runtime it targets.                                                                                              |
| `pnpm test`         | Runs every package's unit, integration, and end-to-end tests.                                                                                          |
| `pnpm format`       | Formats the whole repository with Prettier.                                                                                                            |
| `pnpm format:check` | Fails when a file isn't formatted.                                                                                                                     |

To work on one package, filter by its name, or run its scripts from its directory:

```bash
pnpm --filter @jg-packages/build-tools test:integration
pnpm turbo run lint typecheck --filter=@jg-packages/build-tools
```

Prefer `pnpm turbo run <task> --filter=<package>` when the task needs other packages built first, because Turborepo runs the tasks it depends on. A plain `pnpm --filter` script doesn't.

## Tests

Tests sit next to the file they test, and their suffix sets their category:

| Category    | File suffix            | Script             | Runs in `pnpm check`         |
| ----------- | ---------------------- | ------------------ | ---------------------------- |
| Unit        | `.test-unit.ts`        | `test:unit`        | yes, through `test:coverage` |
| Integration | `.test-integration.ts` | `test:integration` | yes, through `test:coverage` |
| Browser     | `.test-browser.ts`     | `test:browser`     | yes                          |
| End-to-end  | `.test-e2e.ts`         | `test:e2e`         | yes                          |
| Benchmark   | `.test-bench.ts`       | `test:bench`       | no                           |

Each package's `vitest.config.ts` calls `createVitestConfig()` from `@jg-packages/vitest-config` with the categories it has, and each category becomes a Vitest project with the category's name. A package has a script only for the categories it has, and its `test` script runs its unit, integration, browser, and end-to-end tests in that order.

- **Coverage.** Every workspace with unit or integration tests has a `test:coverage` script, `vitest run --coverage` over those projects, and `pnpm check` runs it instead of `test:unit` and `test:integration`, so each suite runs once. It prints a V8 coverage summary of `src`, without tests, test utilities, and fixtures, and fails below the thresholds a package sets with `createVitestConfig({ coverage: { thresholds } })`. Each published package's thresholds are its measured coverage rounded down to whole percents. When tests raise a package's coverage, raise its thresholds by hand to the new values, rounded down, in its `vitest.config.ts`; never lower them to let a change through, but add the tests it's missing. `pnpm release:verify` fails when a workspace has `test:unit` or `test:integration` but no `test:coverage`, because its tests would drop out of `pnpm check` unnoticed.
- **Timeouts.** Tests and hooks fail after 30 seconds, which catches one that hangs without failing a working test on a CI runner several times slower than your machine. A test that needs longer, such as one that packs and installs tarballs, passes its own timeout as the last argument of `test` or the hook.
- **Browser tests** run the same file in headless Chromium, Firefox, and WebKit through Vitest's Playwright provider, for behavior that needs a real browser, such as storage or the clipboard. They can't use Node.js modules.

End-to-end tests run with Playwright instead of Vitest, from the workspace's `playwright.config.ts`, against its build: jg-sw's in Chromium, Firefox, and WebKit, and the website's, in `website/e2e/`, in Chromium against `astro preview` (see [its suite](website.md#end-to-end-tests)). Helpers they share, such as a fixture server, go in `.test-utils.ts` files, which never ship either.

When you add or change integration tests, run them three times with retries off, so a flaky test shows up. Do the same for end-to-end tests:

```bash
pnpm --filter <package> exec vitest run --project integration --repeats=2 --retry=0
pnpm --filter <package> exec playwright test --repeat-each=3 --retries=0
```

## Turborepo and its cache

`turbo.json` declares every task and what it depends on: `build` waits for the builds of the packages it depends on, and integration and end-to-end tests also wait for their own package's build. Turborepo skips a task whose inputs haven't changed and replays its output.

- `pnpm turbo run <task> --force` ignores the cache.
- `pnpm turbo run <task> --summarize` writes a summary under `.turbo/runs/` that lists each task's inputs and why it hit or missed the cache.
- `pnpm turbo run <task> --dry=json` prints the task graph without running anything.

A task's inputs are its package's tracked files plus the shared configuration it reads, such as `internal/tsconfig` for `build` and `typecheck`. When you change a shared configuration package, add it to the inputs of every task that reads it.

## Dependencies

| Kind                                        | Where                               | Range                            |
| ------------------------------------------- | ----------------------------------- | -------------------------------- |
| A dev tool more than one package uses       | `catalog:` in `pnpm-workspace.yaml` | an exact version                 |
| A dev tool only one package uses            | that package's `devDependencies`    | an exact version                 |
| A runtime dependency of a published package | its `dependencies`                  | a caret range, such as `^11.1.5` |
| A published sibling package                 | its `dependencies`                  | `workspace:^`                    |
| An internal package (`@jg-packages/*`)      | `devDependencies`                   | `workspace:*`                    |

To add one, edit the `package.json` (and the catalog when it's shared), then run `pnpm install`. For example, a dev tool every package uses:

```yaml
# pnpm-workspace.yaml
catalog:
  some-tool: 1.2.3
```

```json
{ "devDependencies": { "some-tool": "catalog:" } }
```

Published packages list internal packages only in `devDependencies`, because consumers can't install them.

### Build scripts

pnpm runs no dependency build scripts unless `allowBuilds` in `pnpm-workspace.yaml` approves them, and an install fails when an unapproved package needs one. To approve a package, add it with a comment saying why it needs its script:

```yaml
allowBuilds:
  # downloads the platform binary the CLI runs
  some-package: true
```

Never approve every build.

### Updates

`minimumReleaseAge` keeps its default of one day, so pnpm never installs a version published less than 24 hours ago. To update a dev tool, change its exact version in the catalog or in the package that uses it, run `pnpm install`, then `pnpm check`. To update a runtime dependency, widen its caret range only when the package needs the newer version.

## Branches and commits

- Work happens on `development`. Changes reach `main` through a pull request from `development`, and CI runs on every pull request and on every push to `main`.
- Commits follow Conventional Commits, `<type>(<scope>): <summary>`, with the package's directory name as the scope, such as `feat(jg-utilities): add encodeCursor`, or `repo` for changes to the workspace itself.
- Every commit is signed off and signed: `git commit -s -S`.

## Troubleshooting

- **A package imports a sibling's old code.** The sibling's `dist` is stale. Run `pnpm turbo run build --filter=<package>...` to rebuild it and everything it depends on.
- **Type errors come from a sibling package.** Packages read their siblings' types from `dist`, so build the sibling first, the same way.
- **The install fails on Node.js.** Check `node --version` against the `engines` field: every workspace package needs Node.js 24 or later.
- **The install fails on a build script.** A dependency needs a script `allowBuilds` doesn't approve. Approve it as described under [Build scripts](#build-scripts), or find out why a new version started needing one.
- **The install refuses a version.** It was published less than a day ago. Pick the previous version, or wait.
- **`test:e2e` or `test:browser` fails with "Executable doesn't exist".** A browser is missing, or doesn't match the Playwright version after an update. Run the browser install from [Setup](#setup) again.
- **`test:browser` fails in WebKit with "Host system is missing dependencies".** Install the system libraries it names, with the `install-deps` command from [Setup](#setup).
