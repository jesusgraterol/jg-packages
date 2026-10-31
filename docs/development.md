# Development

How to set up the repository, run its checks, and change its dependencies.

## Requirements

- Node.js 24 or later. CI checks the latest LTS release, and its `floor` job runs the package tests on Node.js 22.17.0, the lowest version the packages support, after building them on the latest LTS. Its 22.17.0 steps set `NODE_OPTIONS=--experimental-strip-types`, because each package's `vitest.config.ts` loads the shared Vitest config, which is TypeScript, and Node.js strips types by default only from 22.18.0. `jg-personal-astro-ui`, which needs Node.js 24, runs its tests on 24.0.0. The `platforms` job runs `jg-fs`, `jg-process`, `jg-git-commands`, and `jg-env`'s unit and integration tests on Windows and macOS, on Node.js 22.17.0, because filesystems, processes, and Git behave differently there. It installs only those packages, their dependencies, and `@jg-packages/api-reference`, whose TypeDoc every build runs, and sets Git's `core.autocrlf` to `false` so the Windows checkout keeps LF line endings.
- pnpm. The root `package.json` pins it with `packageManager`, and pnpm switches itself to that version the first time you run it in the repository.
- Docker, running, for the integration tests of `jg-postgres`, `jg-redis`, and `jg-local-docker`. The first two start their own PostgreSQL and Redis containers with [Testcontainers](https://node.testcontainers.org/), the same images the apps run, and stop them when they finish. `jg-local-docker`'s run the Docker CLI and Compose against the local daemon, creating only containers and Compose projects named `jg-local-docker-test-*`, which they remove. Nothing else needs to be set up, and no other database or container is touched. GitHub's runners have Docker.

## Setup

1. Clone the repository and install:

   ```bash
   git clone git@github.com:jesusgraterol/jg-packages.git
   cd jg-packages
   pnpm install
   ```

   The install should finish without warnings about ignored build scripts. `allowBuilds` in `pnpm-workspace.yaml` lists every install script a dependency asks for, each declined unless the package needs it to work.

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

| Command                | What it does                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`           | Lint, typecheck, build, the unit and integration tests with coverage, and the end-to-end tests, then the browser tests, the format check, and `pnpm release:verify`. |
| `pnpm check:essential` | The same checks with the essential suite, without coverage and without `pnpm release:verify`: a faster check while you work.                                         |
| `pnpm build`           | Builds every package in dependency order.                                                                                                                            |
| `pnpm dev`             | Serves the website at `http://localhost:4321/`, after building the packages it shows, and reloads it as you edit; [`website.md`](website.md) has more.               |
| `pnpm lint`            | Runs ESLint in every package.                                                                                                                                        |
| `pnpm typecheck`       | Typechecks every package against each runtime it targets.                                                                                                            |
| `pnpm test`            | Runs every package's unit, integration, and end-to-end tests, in the essential suite.                                                                                |
| `pnpm test:full`       | Runs the same tests in the full suite.                                                                                                                               |
| `pnpm format`          | Formats the whole repository with Prettier.                                                                                                                          |
| `pnpm format:check`    | Fails when a file isn't formatted.                                                                                                                                   |

To work on one package, filter by its name, or run its scripts from its directory:

```bash
pnpm --filter @jg-packages/build-tools test:integration
pnpm turbo run lint typecheck --filter=@jg-packages/build-tools
```

Prefer `pnpm turbo run <task> --filter=<package>` when the task needs other packages built first, because Turborepo runs the tasks it depends on. A plain `pnpm --filter` script doesn't.

## Tests

Tests sit next to the file they test, and their suffix sets their category. A test of a `.tsx` file is `.tsx` too, such as `.test-browser.tsx`:

| Category    | File suffix            | Script             | Runs in `pnpm check`         |
| ----------- | ---------------------- | ------------------ | ---------------------------- |
| Unit        | `.test-unit.ts`        | `test:unit`        | yes, through `test:coverage` |
| Integration | `.test-integration.ts` | `test:integration` | yes, through `test:coverage` |
| Browser     | `.test-browser.ts`     | `test:browser`     | yes                          |
| End-to-end  | `.test-e2e.ts`         | `test:e2e`         | yes                          |
| Benchmark   | `.test-bench.ts`       | `test:bench`       | no                           |

Each package's `vitest.config.ts` calls `createVitestConfig()` from `@jg-packages/vitest-config` with the categories it has, and each category becomes a Vitest project with the category's name. A package has a script only for the categories it has, and its `test` script runs its unit, integration, browser, and end-to-end tests in that order.

- **Coverage.** Every workspace with unit or integration tests has a `test:coverage` script, `vitest run --coverage` over those projects, and `pnpm check` runs it instead of `test:unit` and `test:integration`, so each suite runs once. It prints a V8 coverage summary of the `.ts` and `.tsx` files in `src`, without tests, test utilities, and fixtures, and fails below the thresholds a package sets with `createVitestConfig({ coverage: { thresholds } })`. A package whose hooks only run in a browser, such as jg-react, adds its browser project's Chromium instance to `test:coverage`, such as `--project unit --project "browser (chromium)"`, because V8 collects browser coverage only in Chromium; those browser tests then run twice in `pnpm check`, once for coverage and once in `test:browser`. `pnpm check` runs `test:browser` after everything else, never beside `test:coverage`: both runs keep the package's Vite dependency bundle in the same `node_modules/.vite/vitest/` folder, but coverage adds a dependency, so each run replaces the other's bundle, and two at once fail with "Failed to fetch dynamically imported module" or an iframe that "did not become ready". CI runs them in separate jobs. `pnpm check` and CI's `tests` job run every other package's coverage four at a time, with turbo's `--concurrency=4`, then the four whose coverage includes Chromium, jg-react, jg-react-router, jg-tanstack-query, and jg-react-ui, one at a time, because beside the other suites their browser projects didn't start within Vitest's minute, on the runner's four CPUs or locally. A package that adds Chromium to its `test:coverage` joins that group in both `.github/workflows/ci.yml` and the root `check` script, and a unit test in `internal/vitest-config` fails when the two lists differ. The `floor` job also runs four packages at a time on Node.js 22.17.0. A package with only browser tests, such as jg-react-router, has a `test:coverage` of that instance alone, `--project "browser (chromium)"`. Each published package's thresholds are its measured coverage rounded down to whole percents. When tests raise a package's coverage, raise its thresholds by hand to the new values, rounded down, in its `vitest.config.ts`; never lower them to let a change through, but add the tests it's missing. `pnpm release:verify` fails when a workspace has `test:unit` or `test:integration` but no `test:coverage`, because its tests would drop out of `pnpm check` unnoticed.
- **Suites.** `JG_TEST_SUITE` accepts `essential` or `full`, defaults to full when unset, and rejects invalid values. Essential protects consequential guarantees; test duration alone never determines membership. Mark useful secondary cases or mixed-file scenario families with `{ tags: ['full'] }`. Declare wholly secondary files in `createVitestConfig({ fullOnlyFiles: [...] })` as well, so essential excludes them before imports. An integration project with no selected files does not start global setup; an unexpectedly empty required invocation still fails. Granular/focused commands remain complete by default, including full-only cases. The existing root launcher sets the mode only for its child, so it cannot leak into later commands. Local full runs are explicit requests; the current `check` and CI still select full until final essential routing is adopted.

### Foundational family classification

Keep coded error/envelope contracts, redaction and secrets, exact decimal/scaled-integer arithmetic, cryptography and random-generation boundaries, deterministic/bounded JSON and cursors, filename/path safety, byte limits, and owned async coordination/cancellation essential. This includes their failure, malformed-input, concurrency, and recovery cases. These guarantees remain selected in jg-exception, jg-api-response, jg-bignumber, jg-crypto, and jg-utilities; fast tests are assessed by consequence too.

Secondary utility coverage includes reading-time estimates, heading-name presentation, date/duration display templates, file-size/badge formatting, capitalization/pluralization, and number-format configuration defaults. Full retains every assertion. Monetary signs/percentages, UTC/time conversions, HTML/Markdown escaping, substitutions, masking/redaction, and Unicode/byte truncation stay essential. Mixed families remain in their existing files; entirely secondary reading-time and format-configuration files are excluded before imports only in essential. Browser-specific utilities are assessed with their real-browser boundary separately.

Complete focused verification is still required for changed behavior and affected consumers, including their full-only cases. Reuse passing checks only while their relevant source, dependencies, configuration, selection and environment inputs remain unchanged. A shared-selector change requires native discovery/default/failure checks and its real-runner fixture, which proves import/setup omission as well as complete full/focused coverage.

### Host and credential boundaries

| Boundary        | Essential guarantee                                                                                                                                             | Full-only coverage                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| jg-fs           | Atomic/stale-write integrity, no-follow/private-file defenses, bounded reads, traversal refusal, lock ownership and explicit recovery.                          | None.                                 |
| jg-process      | Shell-free arguments, byte/deadline limits, cancellation, stdin integrity, readiness and complete owned-process teardown.                                       | None.                                 |
| jg-locks        | Exclusive ownership, nonce-bound recovery, liveness, secure roots, CLI admission/exit codes and accurate holder/recovery evidence.                              | Human-readable duration permutations. |
| jg-env          | Strict parsing, source precedence, private secret files and errors that never expose values.                                                                    | None.                                 |
| jg-git-commands | Exact repository/ref/status interpretation, argument validation, bounded commands and isolation from inherited Git state.                                       | None.                                 |
| jg-local-docker | Local endpoint validation, exact container ownership, loopback-only ports and cleanup after failure or owner exit. Real Docker/Compose fixtures stay essential. | None.                                 |
| jg-github       | Signature/JWT validation, exact repository/permission scopes, token revocation on mismatch, safe URLs/headers and bounded rate-limit recovery.                  | None.                                 |

The host selections retain their complete unit/integration categories except six lock-duration display cases. These stay co-located with essential CLI parsing, owner/status and nonce-bound recovery checks. A slow filesystem, child-process, container or credential test is not secondary by cost. Platform-specific permission, signal, Windows-process and shim cases retain their existing platform conditions; essential selection does not remove them. No host global setup or category is omitted. Use a local Docker endpoint for the owned integration fixtures; their temporary resources and run-specific containers must be removed by teardown.

### Persistence, HTTP and server boundaries

| Boundary    | Essential guarantee                                                                                                                                                                  | Full-only coverage                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| jg-postgres | Real transactions/rollback, pool and advisory-lock ownership, stable cursor pages, exact counters/limits, verification-code and inbox idempotency, and SQL/client deadline recovery. | None.                                                           |
| jg-redis    | Cache/schema/key isolation and fallback, atomic single-use claims/values, expiry and fail-closed coordination when Redis fails.                                                      | None.                                                           |
| jg-fetch    | Bounded bodies/deadlines, safe retries and aborts, one-shot stream handling, credential-refresh limits, schema/envelope/error mapping and redacted diagnostics.                      | The existing 300-run option-combination property qualification. |
| jg-nestjs   | Real HTTP/module/lifecycle wiring for validation and errors, CORS, bounded uploads, fail-closed maintenance/IP/Turnstile guards and listen-failure cleanup.                          | None.                                                           |

PostgreSQL's three profiled-client deadline/reuse/destruction cases and the optional reader's real SQL cancellation case are essential. Their real waits uniquely establish connection safety and cancellation; `pg_sleep` is not a reason to mark a case full-only. Database and cache setup remain required in essential. Use the existing disposable Testcontainers fixtures, not shared application databases or mocked replacements.

HTTP property permutations supplement the focused essential request cases and stay in full. The entire property file is excluded before imports only in essential; complete granular/focused integration commands still run it. Required failure, timeout, schema, credential and recovery coverage stays essential in the same package. No timeout, retry, threshold or production behavior changes accompany this selection.

### Runner mechanics

- **No file module cache.** `createVitestConfig` turns off Vitest's file module cache, `fsModuleCache`, in the root and every project. The cache is one directory, `node_modules/.vitest-cache`, that every run in the workspace shares, and a lockfile change makes each run clear it, so runs started together failed with `ENOTEMPTY`. It saved no measurable time.
- **Timeouts.** Tests and hooks fail after 30 seconds, which catches one that hangs without failing a working test on a CI runner several times slower than your machine. A test that needs longer, such as one that packs and installs tarballs, passes its own timeout as the last argument of `test` or the hook.
- **Browser tests** run the same file in headless Chromium, Firefox, and WebKit through Vitest's Playwright provider, for behavior that needs a real browser, such as storage or the clipboard. They can't use Node.js modules.

End-to-end tests run with Playwright instead of Vitest, from the workspace's `playwright.config.ts`, against its build: jg-sw's and the private Astro UI gallery's in Chromium, Firefox, and WebKit, and the website's, in `website/e2e/`, in Chromium against `astro preview` (see [its suite](website.md#end-to-end-tests)). The gallery's shared scenarios are co-located with `gallery/src/layouts/gallery-layout.astro`, outside Astro's pages directory; component scenarios live beside their owning `.astro` files under `src/components/`. The release fixture copies both sets into its installed consumer. The preview integration test lives beside `gallery/preview.ts` and uses a real temporary CLI without needing a gallery build. Helpers they share, such as a fixture server, go in `.test-utils.ts` files, which never ship either.

When you add or change integration tests, run them three times with retries off, so a flaky test shows up. Do the same for end-to-end tests:

```bash
pnpm --filter <package> exec vitest run --project integration --repeats=2 --retry=0
pnpm --filter <package> exec playwright test --repeat-each=3 --retries=0
```

## Turborepo and its cache

`turbo.json` declares every task and what it depends on: `build` waits for the builds of the packages it depends on, and integration and end-to-end tests also wait for their own package's build. The website's `build`, `typecheck`, and `lint` run one after another, as `website/turbo.json` declares, because each one syncs Astro's content into the same files, and two syncs at once fail with `UnknownFilesystemError`. Turborepo skips a task whose inputs haven't changed and replays its output.

- `pnpm turbo run <task> --force` ignores the cache.
- `pnpm turbo run <task> --summarize` writes a summary under `.turbo/runs/` that lists each task's inputs and why it hit or missed the cache.
- `pnpm turbo run <task> --dry=json` prints the task graph without running anything.

The test tasks declare `JG_TEST_SUITE` in their `env`, so the variable reaches them, and each suite has its own cache entries.

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
- **The install fails on Node.js.** Check `node --version` against the `engines` field: developing in the repository needs Node.js 24 or later, though the published packages support 22.17.0.
- **The install fails on a build script.** A dependency needs a script `allowBuilds` doesn't approve. Approve it as described under [Build scripts](#build-scripts), or find out why a new version started needing one.
- **The install refuses a version.** It was published less than a day ago. Pick the previous version, or wait.
- **`test:e2e` or `test:browser` fails with "Executable doesn't exist".** A browser is missing, or doesn't match the Playwright version after an update. Run the browser install from [Setup](#setup) again.
- **`test:browser` fails in WebKit with "Host system is missing dependencies".** Install the system libraries it names, with the `install-deps` command from [Setup](#setup).
