# jg-packages

Jesus Graterol's personal npm packages, published under `jg-*` names and built, tested, and released from one pnpm and Turborepo monorepo. Every package is ESM only, does no work when it's imported, exports its error codes, and is tested from the exact tarball that gets published.

## Packages

| Package                                           | What it does                                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`jg-exception`](packages/jg-exception)           | Coded errors for every jg package: an `Exception` with a stable code and JSON data, message extraction, and code checks.              |
| [`jg-api-response`](packages/jg-api-response)     | Builds and recognises the `{ success, data, error }` envelope services exchange over HTTP.                                            |
| [`jg-utilities`](packages/jg-utilities)           | Validations, transformers, generators, and collection, async, and environment utilities.                                              |
| [`jg-bignumber`](packages/jg-bignumber)           | Exact decimal math with bignumber.js: rounding, formatting, and financial calculations.                                               |
| [`jg-fs`](packages/jg-fs)                         | Filesystem helpers for Node.js, async and sync: paths, directories, text, JSON, atomic and bounded files.                             |
| [`jg-process`](packages/jg-process)               | Runs and stops child processes without a shell: timeouts, output limits, abort signals, process trees.                                |
| [`jg-storage`](packages/jg-storage)               | Typed key-value stores over localStorage, sessionStorage, IndexedDB, and memory, for browsers and workers.                            |
| [`jg-sw`](packages/jg-sw)                         | Service workers for web apps: a generated caching worker with a Vite plugin and CLI, plus registration, updates, and installation.    |
| [`jg-fetch`](packages/jg-fetch)                   | A fetch wrapper for browsers and Node.js that never throws: timeouts, retries with Retry-After, response caps, and API envelopes.     |
| [`jg-clipboard`](packages/jg-clipboard)           | Copies and reads text, HTML, and images on the browser clipboard, with support detection and errors that say why the browser refused. |
| [`jg-env`](packages/jg-env)                       | Reads environment variables strictly from any source, and secrets from files, with errors that name the key and never the value.      |
| [`jg-postgres`](packages/jg-postgres)             | node-postgres helpers: safe transactions, advisory locks, SQLSTATE checks, cursor pages, and ordered lists.                           |
| [`jg-redis`](packages/jg-redis)                   | A read-through cache that survives Redis failing, and fail-closed one-time claims, on node-redis.                                     |
| [`jg-react`](packages/jg-react)                   | React hooks for online status, page visibility, Tailwind CSS breakpoints, and scroll thresholds.                                      |
| [`jg-tanstack-query`](packages/jg-tanstack-query) | TanStack Query with safe defaults, opt-in IndexedDB persistence, and a sign-out clear that waits for restore.                         |
| [`jg-react-router`](packages/jg-react-router)     | A page outlet that focuses new pages and restores scroll on Back and Forward, and dialogs that close when the route changes.          |
| [`jg-nestjs`](packages/jg-nestjs)                 | NestJS for HTTP APIs: an ApiException, a filter and an interceptor for one envelope, schema validation, CORS, and app bootstrap.      |
| [`jg-crypto`](packages/jg-crypto)                 | Hashing, random bytes and digits, HMAC signatures with constant-time verification, and authenticator app codes, for Node.js.          |
| [`jg-git-commands`](packages/jg-git-commands)     | Git commands for Node.js that never prompt or inherit Git environment variables, with time and output limits and typed reads.         |
| [`jg-local-docker`](packages/jg-local-docker)     | Checks for Node.js scripts that Docker is local before using it, plus Compose service and container reads with loopback-only ports.   |
| [`jg-github`](packages/jg-github)                 | GitHub App authentication for Node.js: app tokens, scoped installation tokens, webhook signatures, and rate-limit retry times.        |
| [`jg-site`](packages/jg-site)                     | Structured data, llms.txt files, and theme preferences for websites, in browsers and Node.js.                                         |
| [`jg-playwright`](packages/jg-playwright)         | Playwright helpers for overflow, loaded assets, motion, axe scans, secret fields, and a fake microphone.                              |

[`jg-personal-astro-ui`](packages/jg-personal-astro-ui) is also published from `packages/`: the Astro components and theme Jesus Graterol's own sites share. It isn't meant for general use, so the website doesn't list it.

Each package gets a row here when it's added to `packages/`.

## Quick start

Developing needs Node.js 24 or later and pnpm, which switches itself to the version pinned in `package.json`. The published packages support Node.js 22.17.0 and later, except `jg-personal-astro-ui`, which needs 24.

```bash
pnpm install
pnpm --filter jg-sw exec playwright install chromium firefox webkit
pnpm check
```

`pnpm check` runs every check CI runs: lint, typecheck, unit tests, builds, integration and end-to-end tests, the format check, and the release checks. [`docs/development.md`](docs/development.md) covers the rest of the daily workflow.

Preview the shared Astro components locally with `pnpm --filter jg-personal-astro-ui gallery:dev`. Its private gallery and browser checks are described in [`docs/personal-astro-ui.md`](docs/personal-astro-ui.md#private-gallery).

## Documentation

| I want to…                                        | Read                                                       |
| ------------------------------------------------- | ---------------------------------------------------------- |
| set up the repo, run checks, and add dependencies | [`docs/development.md`](docs/development.md)               |
| follow the conventions every package shares       | [`docs/package-guidelines.md`](docs/package-guidelines.md) |
| create a package                                  | [`docs/creating-a-package.md`](docs/creating-a-package.md) |
| release a version, or publish a new package       | [`docs/releasing.md`](docs/releasing.md)                   |
| work on the website                               | [`docs/website.md`](docs/website.md)                       |
| deploy the website, or change its domain or rules | [`docs/deployment.md`](docs/deployment.md)                 |
| use or change the shared Astro components         | [`docs/personal-astro-ui.md`](docs/personal-astro-ui.md)   |
| check where a font, icon, or mark comes from      | [`docs/asset-attribution.md`](docs/asset-attribution.md)   |

## Project blueprint

```text
.
├── .github/workflows/ci.yml  # the parallel check jobs, then the deploy, publish, and tag jobs
├── docs/
│   ├── asset-attribution.md  # where the website's mark, fonts, and icons come from
│   ├── creating-a-package.md # every step from a package's name to its first release
│   ├── deployment.md         # GitHub Pages, the domain, and the Cloudflare rules for Markdown
│   ├── development.md        # setup, commands, dependencies, branches, troubleshooting
│   ├── package-guidelines.md # conventions every package follows
│   ├── personal-astro-ui.md  # the shared Astro components and their token contract
│   ├── releasing.md          # versions, the release checks, publishing, and tags
│   └── website.md            # the website: its content, pages, search, checks, and tests
├── internal/                 # private workspace packages, never published
│   ├── api-reference/        # extracts each package's API with TypeDoc, and renders API.md
│   ├── build-tools/          # clean-dist and copy-assets scripts used by package builds
│   ├── eslint-config/        # createEslintConfig(), the shared ESLint flat configuration
│   ├── release-checks/       # the verify, pack, publish, and tag release commands
│   ├── tsconfig/             # base, library, browser and node TypeScript configurations
│   └── vitest-config/        # createVitestConfig(), one Vitest project per test category, and the suites
├── packages/                 # the published jg-* packages, and jg-personal-astro-ui
│   └── jg-personal-astro-ui/gallery/ # private rendered examples and preview lifecycle tests
├── website/                  # the Astro site at jg-packages.jesusgraterol.dev, private
├── LICENSE
├── package.json              # workspace scripts, pinned pnpm, Node.js engines
├── pnpm-workspace.yaml       # workspace globs and the version catalog
└── turbo.json                # the task graph and cache inputs
```

- Internal packages run from their TypeScript sources with Node.js type stripping, so they have no build step. Their relative imports keep the `.ts` extension.
- `docs/` holds concise documentation of essential, durable project concepts and processes. Package API references stay in each package's `API.md`, outside `docs/`.
- Every task `turbo run` targets, in scripts, CI, and the docs, is declared in `turbo.json`.
- Every package's build ends by writing `API.md`, its API reference rendered from its TSDoc, which ships in its tarball and is git-ignored.
- Local coding instructions (`AGENTS.md`, `CLAUDE.md`, `CANDIDATE.md`) and `coding-agent-planning/` are git-ignored and never published.

## License

[MIT](LICENSE)
