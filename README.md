# JG Packages

Jesus Graterol's personal npm packages, published under `jg-*` names and built, tested, and released from one pnpm and Turborepo monorepo. Every package is ESM only, does no work when it's imported, exports its error codes, and is tested from the exact tarball that gets published.

## Packages

| Package                                 | What it does                                                                             | Replaces              |
| --------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------- |
| [`jg-exception`](packages/jg-exception) | Extracts, encodes, and decodes error messages and codes, with a coded `Exception` class. | `error-message-utils` |

Each package gets a row here when it's added to `packages/`.

## Quick start

You need Node.js 24 or later and pnpm, which switches itself to the version pinned in `package.json`.

```bash
pnpm install
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

## Project blueprint

```text
.
├── .github/workflows/ci.yml  # the check and floor jobs
├── docs/
│   ├── creating-a-package.md # every step from a package's name to its first release
│   ├── development.md        # setup, commands, dependencies, branches, troubleshooting
│   ├── package-guidelines.md # conventions every package follows
│   └── releasing.md          # versions, the release checks, publishing, and tags
├── internal/                 # private workspace packages, never published
│   ├── api-reference/        # extracts each package's API and TSDoc with TypeDoc
│   ├── build-tools/          # clean-dist and copy-assets scripts used by package builds
│   ├── eslint-config/        # createEslintConfig(), the shared ESLint flat configuration
│   ├── release-checks/       # the verify, pack, publish, and tag release commands
│   ├── tsconfig/             # base, library, browser and node TypeScript configurations
│   └── vitest-config/        # createVitestConfig(), one Vitest project per test category
├── packages/                 # the published jg-* packages
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
