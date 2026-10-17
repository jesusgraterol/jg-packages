# JG Packages

Jesus Graterol's personal npm packages, published under `jg-*` names and built, tested, and released from one pnpm and Turborepo monorepo. Every package is ESM only, does no work when it's imported, exports its error codes, and is tested from the exact tarball that gets published.

## Packages

| Package                                       | What it does                                                                                                                       | Replaces                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| [`jg-exception`](packages/jg-exception)       | Extracts, encodes, and decodes error messages and codes, with a coded `Exception` class.                                           | `error-message-utils`                         |
| [`jg-api-response`](packages/jg-api-response) | Builds and recognises the `{ success, data, error }` envelope services exchange over HTTP.                                         | `api-response-utils`                          |
| [`jg-utilities`](packages/jg-utilities)       | Validations, transformers, generators, and collection, async, and environment utilities.                                           | `web-utils-kit`                               |
| [`jg-bignumber`](packages/jg-bignumber)       | Exact decimal math with bignumber.js: rounding, formatting, and financial calculations.                                            | `bignumber-utils`                             |
| [`jg-fs`](packages/jg-fs)                     | Filesystem helpers for Node.js, async and sync: paths, directories, text, JSON, atomic and bounded files.                          | `fs-utils-async`, `fs-utils-sync`             |
| [`jg-process`](packages/jg-process)           | Runs and stops child processes without a shell: timeouts, output limits, abort signals, process trees.                             | `node-process-utils`                          |
| [`jg-storage`](packages/jg-storage)           | Typed key-value stores over localStorage, sessionStorage, IndexedDB, and memory, for browsers and workers.                         | `browser-keyval-stores`                       |
| [`jg-sw`](packages/jg-sw)                     | Service workers for web apps: a generated caching worker with a Vite plugin and CLI, plus registration, updates, and installation. | `sw-service`, `sw-builder`                    |
| [`jg-fetch`](packages/jg-fetch)               | A fetch wrapper for browsers and Node.js that never throws: timeouts, retries with Retry-After, response caps, and API envelopes.  | `fetch-request-browser`, `fetch-request-node` |

[`jg-personal-astro-ui`](packages/jg-personal-astro-ui) is also published from `packages/`: the Astro components and theme Jesus Graterol's own sites share. It isn't meant for general use, so the website doesn't list it.

Each package gets a row here when it's added to `packages/`.

## Quick start

You need Node.js 24 or later and pnpm, which switches itself to the version pinned in `package.json`.

```bash
pnpm install
pnpm --filter jg-sw exec playwright install chromium
pnpm check
```

`pnpm check` runs every check CI runs: lint, typecheck, unit tests, builds, integration and end-to-end tests, the format check, and the release checks. [`docs/development.md`](docs/development.md) covers the rest of the daily workflow.

## Documentation

| I want to…                                        | Read                                                       |
| ------------------------------------------------- | ---------------------------------------------------------- |
| set up the repo, run checks, and add dependencies | [`docs/development.md`](docs/development.md)               |
| follow the conventions every package shares       | [`docs/package-guidelines.md`](docs/package-guidelines.md) |
| create a package                                  | [`docs/creating-a-package.md`](docs/creating-a-package.md) |
| release a version, or publish a new package       | [`docs/releasing.md`](docs/releasing.md)                   |
| work on the website                               | [`docs/website.md`](docs/website.md)                       |
| use or change the shared Astro components         | [`docs/personal-astro-ui.md`](docs/personal-astro-ui.md)   |
| check where a font, icon, or mark comes from      | [`docs/asset-attribution.md`](docs/asset-attribution.md)   |

## Project blueprint

```text
.
├── .github/workflows/ci.yml  # the check, floor, publish, and tag jobs
├── docs/
│   ├── asset-attribution.md  # where the website's mark, fonts, and icons come from
│   ├── creating-a-package.md # every step from a package's name to its first release
│   ├── development.md        # setup, commands, dependencies, branches, troubleshooting
│   ├── package-guidelines.md # conventions every package follows
│   ├── personal-astro-ui.md  # the shared Astro components and their token contract
│   ├── releasing.md          # versions, the release checks, publishing, and tags
│   └── website.md            # running the website and where its content comes from
├── internal/                 # private workspace packages, never published
│   ├── api-reference/        # extracts each package's API and TSDoc with TypeDoc
│   ├── build-tools/          # clean-dist and copy-assets scripts used by package builds
│   ├── eslint-config/        # createEslintConfig(), the shared ESLint flat configuration
│   ├── release-checks/       # the verify, pack, publish, and tag release commands
│   ├── tsconfig/             # base, library, browser and node TypeScript configurations
│   └── vitest-config/        # createVitestConfig(), one Vitest project per test category
├── packages/                 # the published jg-* packages, and jg-personal-astro-ui
├── website/                  # the Astro site at jg-packages.jesusgraterol.dev, private
├── LICENSE
├── package.json              # workspace scripts, pinned pnpm, Node.js engines
├── pnpm-workspace.yaml       # workspace globs and the version catalog
└── turbo.json                # the task graph and cache inputs
```

- Internal packages run from their TypeScript sources with Node.js type stripping, so they have no build step. Their relative imports keep the `.ts` extension.
- Every task `turbo run` targets, in scripts, CI, and the docs, is declared in `turbo.json`.
- Local coding instructions (`AGENTS.md`, `CLAUDE.md`, `CANDIDATE.md`) and `coding-agent-planning/` are git-ignored and never published.

## License

[MIT](LICENSE)
