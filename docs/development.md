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

| Command                | What it does                                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`           | Lint, typecheck, build, essential unit/integration/browser/end-to-end tests, and formatting.                                                    |
| `pnpm check:essential` | Alias for `pnpm check`.                                                                                                                         |
| `pnpm check:full`      | Complete checks, including coverage thresholds, all browser/E2E cases, formatting and release verification. Run only when explicitly requested. |
| `pnpm build`           | Builds every package in dependency order.                                                                                                       |
| `pnpm dev`             | Serves the website at `http://localhost:4321/`; see [website development](website.md).                                                          |
| `pnpm lint`            | Runs ESLint in every package.                                                                                                                   |
| `pnpm typecheck`       | Typechecks every package against its supported runtimes.                                                                                        |
| `pnpm test`            | Essential unit, integration, browser and end-to-end tests.                                                                                      |
| `pnpm test:full`       | Complete unit, integration, browser and end-to-end tests.                                                                                       |
| `pnpm format`          | Formats the whole repository.                                                                                                                   |
| `pnpm format:check`    | Fails when a file is not formatted.                                                                                                             |

To work on one package, filter by its name, or run its scripts from its directory:

```bash
pnpm --filter @jg-packages/build-tools test:integration
pnpm turbo run lint typecheck --filter=@jg-packages/build-tools
```

Prefer `pnpm turbo run <task> --filter=<package>` when the task needs other packages built first, because Turborepo runs the tasks it depends on. A plain `pnpm --filter` script doesn't.

## Tests

Tests sit next to the file they test, and their suffix sets their category. A test of a `.tsx` file is `.tsx` too, such as `.test-browser.tsx`:

| Category    | File suffix            | Workspace script   | Root `pnpm check`                                |
| ----------- | ---------------------- | ------------------ | ------------------------------------------------ |
| Unit        | `.test-unit.ts`        | `test:unit`        | essential selection                              |
| Integration | `.test-integration.ts` | `test:integration` | essential selection                              |
| Browser     | `.test-browser.ts`     | `test:browser`     | assessed Chromium selection                      |
| End-to-end  | `.test-e2e.ts`         | `test:e2e`         | essential library journeys; website is full-only |
| Benchmark   | `.test-bench.ts`       | `test:bench`       | excluded                                         |

Each package's `vitest.config.ts` calls `createVitestConfig()` from `@jg-packages/vitest-config` with the categories it has, and each category becomes a Vitest project with the category's name. A package has a script only for the categories it has, and its `test` script runs its unit, integration, browser, and end-to-end tests in that order.

- **Coverage.** Unit/integration workspaces retain `test:coverage`, using Vitest V8 and their existing thresholds. `pnpm check:full` runs those tasks instead of separate unit/integration tasks, then runs browser tests after coverage to avoid competing Vite dependency bundles. Four Chromium coverage consumers (jg-react, jg-react-router, jg-tanstack-query and jg-react-ui) run one at a time; the others run with concurrency four. A new Chromium coverage consumer joins the complementary filters in `check:full`; the shared runner's unit test checks those groups. Browser-only packages include their Chromium instance in coverage. Thresholds stay at measured whole percentages and must never be lowered to make a change pass. Essential checks and CI do not collect coverage or enforce percentage thresholds; enforcement happens only through explicitly requested complete coverage/check commands. The release workspace-script guard still requires coverage scripts, so no workspace silently drops out of `check:full`.
- **Suites.** `JG_TEST_SUITE` accepts `essential` or `full`, defaults to full when unset, and rejects invalid values. Essential protects consequential guarantees; test duration alone never determines membership. Mark useful secondary cases or mixed-file scenario families with `{ tags: ['full'] }`. Declare wholly secondary files in `createVitestConfig({ fullOnlyFiles: [...] })` as well, so essential excludes them before imports. An integration project with no selected files does not start global setup; an unexpectedly empty required invocation still fails. Granular/focused commands remain complete by default, including full-only cases. The existing root launcher sets the mode only for its child, so it cannot leak into later commands. Local full runs are explicit requests; `check` and every CI regression job select essential. The release job remains complete.

### Foundational family classification

Keep coded error/envelope contracts, redaction and secrets, exact decimal/scaled-integer arithmetic, cryptography and random-generation boundaries, deterministic/bounded JSON and cursors, filename/path safety, byte limits, and owned async coordination/cancellation essential. This includes their failure, malformed-input, concurrency, and recovery cases. These guarantees remain selected in jg-exception, jg-api-response, jg-bignumber, jg-crypto, and jg-utilities; fast tests are assessed by consequence too.

Secondary utility coverage includes reading-time estimates, heading-name presentation, date/duration display templates, file-size/badge formatting, capitalization/pluralization, and number-format configuration defaults. Full retains every assertion. Monetary signs/percentages, UTC/time conversions, HTML/Markdown escaping, substitutions, masking/redaction, and Unicode/byte truncation stay essential. Mixed families remain in their existing files; entirely secondary reading-time and format-configuration files are excluded before imports only in essential. The additional real-DOM download qualification is full-only; its owned serialization, click/removal and URL-revocation rules already have complete focused unit coverage.

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

### Browser and client-state boundaries

| Boundary             | Essential guarantee                                                                                                                                                                                                                                           | Full-only coverage                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| jg-storage           | Real local/session/IndexedDB persistence, schema checks, key namespaces, and probes that never remove user records.                                                                                                                                           | Additional browser engines.                                                                           |
| jg-clipboard         | Real trusted-click writes, exact payload/MIME handling, permission failures and bounded private clipboard reads.                                                                                                                                              | Additional browser engines.                                                                           |
| jg-sw                | Production worker privacy/cache exclusions, safe version updates, offline/error recovery and supported lifecycle/installation behavior.                                                                                                                       | Additional browser engines.                                                                           |
| jg-react             | Server-safe snapshots, dialog sessions/focus, unsaved form state, resend availability, upload admission/commit/cancel/revocation, current searches and online/visibility lifecycle. Safe theme-script serialization/CSP and option validation stay essential. | Layout/active-heading/theme presentation, copy-feedback duration permutations and additional engines. |
| jg-react-router      | Primary eager/lazy routes, scoped dialogs, safe return/search state, focus and Back/Forward restoration.                                                                                                                                                      | Page metadata, CSS class/fade presentation and additional engines.                                    |
| jg-tanstack-query    | Identity approval, private persisted-cache isolation and sign-out clearing, fresh query boundaries, seeded pagination and bounded/error-aware polling.                                                                                                        | Additional browser engines.                                                                           |
| jg-site              | JSON-LD serialization cannot close its script element.                                                                                                                                                                                                        | Ordinary SEO/llms/theme outputs and permutations.                                                     |
| jg-playwright        | Protected field failures never disclose their value; fake microphone ownership/permission and teardown controls.                                                                                                                                              | Asset, overflow, axe and motion helper qualifications, plus additional engines.                       |
| jg-utilities browser | Its owned download rules remain covered by essential unit cases.                                                                                                                                                                                              | The additional DOM/Blob-URL download qualification, in every engine.                                  |

Assessed browser consumers set `essentialBrowser: 'chromium'`; default/full/focused runs retain Chromium, Firefox and WebKit. Unassessed consumers retain their existing engines. Keep any distinct consequential engine-specific scenario essential on the engine it needs; a matrix is secondary only when it adds no distinct guarantee. Cross-engine regressions beyond the representative cases are exercised by explicitly requested full or complete affected-consumer checks.

The [React UI classification](personal-ui.md#essential-and-full-tests) retains native form/modal behavior, private state/error boundaries, bounded uploads and recording, safe draft/source handling and recovery in essential. Foundation asset safety and the installed-gallery selection boundary stay essential too. Static component/artwork permutations are full-only; the workspace gallery keeps four distinct compiled journeys while its installed release consumer always runs the complete three-engine qualification.

The [Astro UI classification](personal-astro-ui.md#essential-and-full-tests) keeps safe source/HTML processing, bounded algorithms, real interaction and teardown rules essential. Its representative compiled gallery journeys cover Pagefind recovery, navigation, dialog history, tabs, accordion links and exact clipboard source. Presentation matrices and duplicate qualifications are full-only; installed release consumers still qualify every case in all three engines.

Root `test` includes every applicable correctness category. Its browser task omits jg-utilities before browser startup because that category is entirely secondary; its complete granular browser command remains available. Root `test:full` includes the complete browser category too. `check` composes static/build gates, essential test selection and formatting; `check:essential` is its alias. Website E2E tasks are omitted before Playwright startup, and library E2E workspaces run one at a time. No coverage or release verification is added to essential.

Wholly secondary files are excluded before imports with explicit file patterns. Do not place an essential scenario inside a fully excluded file: remove that file-level exclusion and tag only its secondary families. Mixed files retain consequential failure, cleanup, ownership and recovery cases; full still retains every useful accessibility, keyboard/focus, viewport, theme and motion assertion.

### Runner mechanics

- **No file module cache.** `createVitestConfig` turns off Vitest's file module cache, `fsModuleCache`, in the root and every project. The cache is one directory, `node_modules/.vitest-cache`, that every run in the workspace shares, and a lockfile change makes each run clear it, so runs started together failed with `ENOTEMPTY`. It saved no measurable time.
- **Timeouts.** Tests and hooks fail after 30 seconds, which catches one that hangs without failing a working test on a CI runner several times slower than your machine. A test that needs longer, such as one that packs and installs tarballs, passes its own timeout as the last argument of `test` or the hook.
- **Browser tests** run the same file in headless Chromium, Firefox, and WebKit through Vitest's Playwright provider, for behavior that needs a real browser, such as storage or the clipboard. They can't use Node.js modules.

End-to-end tests use each workspace's Playwright configuration against its build. Essential selects assessed Chromium journeys in the libraries and private galleries; complete commands retain each workspace's engines and cases, including the website. Gallery scenarios remain beside their owning components or gallery layout, and installed release fixtures copy the same maintained scenarios. Preview/process integration tests use real temporary CLIs without requiring gallery builds; shared test support stays out of published output.

CI retains all three required E2E shard statuses. Shard 1 runs the nonempty essential selection without sharding, serializing independent browser pools. Shards 2/3 report intentional no-work success before installation or browser setup. When the existing main-push upload applies, shard 1 builds the website explicitly through its Turbo task before uploading it. Browser regression installs Chromium only. The unit/integration status retains its existing name for branch protection, although it now runs essential tests without coverage. Floor and OS jobs retain their filters, Node versions and meaningful platform guarantees, with essential mode passed explicitly to the existing launcher.

### Private tooling and website

Build-tools deletion/path safety, real CLI behavior, and the shared lint factory's TypeScript/Astro/worker environments stay essential. API extraction retains public-entry inventory and missing-source refusal; documentation presence, formatting, signature/example presentation and extra extraction permutations are full-only. Release tests keep artifact allowlists/exports, exact tarball bytes/checksums, registry/version rules, publish/tag ordering and idempotence, invalid CLI admission, complete installed-gallery selection, bounded cancellation and teardown essential. Real pack/manifest success, refusing occupied output, rejecting leaked tests/missing exports, empty-package refusal and the workspace-coverage guard stay essential. Documentation/example checker qualifications and additional installed-code assertion qualifications are full-only.

The website retains HTML/URL/script-injection defenses, escaped API text, private-package catalog exclusion, owned process teardown and built-artifact test/private-name rejection. Ordinary content, SEO, presentation, inventory permutations and the entire website E2E category are full-only. Its normal production build still executes every build verification rule.

### CI limits

Full runs locally only on explicit request. Coverage percentages and secondary OS/browser matrices have no automatic regression gate; use complete focused commands for affected behavior and consumers, including their full-only cases, on the appropriate host. Unchanged successful evidence remains reusable. No periodic run or manual routine is introduced.

The release job still runs complete `release:verify` or `release:pack`, including installed galleries and every browser engine, and remains required by publish/deploy alongside all existing checks. Its selection never inherits a reduced job-wide mode. Measured PR release qualification took 11m33s (verification 9m44s), versus 5m52s for the slowest regression job; a push took 10m13s (packing 8m17s), versus 7m54s for regression. Reducing regression work saves runner minutes and local time but does not shorten that existing CI critical path. Profiling release qualification is separate follow-up work; this task changes no release policy.

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

The shared runner's unit and coverage tasks hash root `package.json` through `internal/vitest-config/turbo.json`, preserving inherited inputs. Root command changes therefore invalidate the complementary coverage-group check.

Release-check integration and coverage tasks also hash both galleries' Playwright configurations, owning manifests, and version catalog through `internal/release-checks/turbo.json`. They retain the inherited inputs and task dependencies. This keeps the copied-consumer guard current without invalidating unrelated packages' test caches.

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
