# jg-packages

Jesus Graterol's personal npm packages, published under `jg-*` names and built, tested, and released from one pnpm and Turborepo monorepo.

## Project blueprint

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

[Delivery](docs/delivery.md) defines ordered source/publication stops, verification and task cleanup. Package APIs stay with each package's README and generated `API.md`.

`packages/` owns published libraries, `internal/` owns private build/test/release tooling, and `website/` owns the public package site. `docs/` contains durable workspace guidance, with a detailed [source map](docs/development.md#source-map).

## Packages

| Package                                                 | What it does                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`jg-exception`](packages/jg-exception)                 | Coded errors for every jg package: an `Exception` with a stable code and JSON data, message extraction, and code checks.              |
| [`jg-api-response`](packages/jg-api-response)           | Builds and recognises the `{ success, data, error }` envelope services exchange over HTTP.                                            |
| [`jg-utilities`](packages/jg-utilities)                 | Validations, transformers, generators, and collection, async, and environment utilities.                                              |
| [`jg-bignumber`](packages/jg-bignumber)                 | Exact decimal math with bignumber.js: rounding, formatting, and financial calculations.                                               |
| [`jg-fs`](packages/jg-fs)                               | Filesystem helpers for Node.js: paths, atomic and bounded files, streamed SHA-256, and verified installs.                             |
| [`jg-process`](packages/jg-process)                     | Runs foreground and captured commands without a shell, with bounded output, cancellation, and process trees.                          |
| [`jg-storage`](packages/jg-storage)                     | Typed key-value stores over localStorage, sessionStorage, IndexedDB, and memory, for browsers and workers.                            |
| [`jg-sw`](packages/jg-sw)                               | Service workers for web apps: a generated caching worker with a Vite plugin and CLI, plus registration, updates, and installation.    |
| [`jg-fetch`](packages/jg-fetch)                         | A fetch wrapper for browsers and Node.js that never throws: timeouts, retries with Retry-After, response caps, and API envelopes.     |
| [`jg-clipboard`](packages/jg-clipboard)                 | Copies and reads text, HTML, and images on the browser clipboard, with support detection and errors that say why the browser refused. |
| [`jg-env`](packages/jg-env)                             | Reads environment variables strictly from any source, and secrets from files, with errors that name the key and never the value.      |
| [`jg-postgres`](packages/jg-postgres)                   | node-postgres helpers: safe transactions, advisory locks, SQLSTATE checks, cursor pages, and ordered lists.                           |
| [`jg-redis`](packages/jg-redis)                         | A read-through cache that survives Redis failing, and fail-closed one-time claims, on node-redis.                                     |
| [`jg-react`](packages/jg-react)                         | React hooks for online status, page visibility, Tailwind CSS breakpoints, and scroll thresholds.                                      |
| [`jg-tanstack-query`](packages/jg-tanstack-query)       | TanStack Query with safe defaults, opt-in IndexedDB persistence, and a sign-out clear that waits for restore.                         |
| [`jg-react-router`](packages/jg-react-router)           | A page outlet that focuses new pages and restores scroll on Back and Forward, and dialogs that close when the route changes.          |
| [`jg-nestjs`](packages/jg-nestjs)                       | NestJS for HTTP APIs: an ApiException, a filter and an interceptor for one envelope, schema validation, CORS, and app bootstrap.      |
| [`jg-crypto`](packages/jg-crypto)                       | Hashing, random bytes and digits, HMAC signatures with constant-time verification, and authenticator app codes, for Node.js.          |
| [`jg-git-commands`](packages/jg-git-commands)           | Git commands for Node.js that never prompt or inherit Git environment variables, with time and output limits and typed reads.         |
| [`jg-local-docker`](packages/jg-local-docker)           | Checks for Node.js scripts that Docker is local before using it, plus Compose service and container reads with loopback-only ports.   |
| [`jg-github`](packages/jg-github)                       | GitHub App authentication for Node.js: app tokens, scoped installation tokens, webhook signatures, and rate-limit retry times.        |
| [`jg-site`](packages/jg-site)                           | Structured data, llms.txt files, and theme preferences for websites, in browsers and Node.js.                                         |
| [`jg-playwright`](packages/jg-playwright)               | Playwright helpers for overflow, loaded assets, motion, axe scans, secret fields, and a fake microphone.                              |
| [`jg-locks`](packages/jg-locks)                         | Machine-wide named locks for scripts, agents, and apps: waits, a status of every holder, explicit recovery, and a CLI.                |
| [`jg-render`](packages/jg-render)                       | Render prepared HTML to exact PNGs with offline Chromium, local fonts and images, and an optional layout check.                       |
| [`jg-site-checks`](packages/jg-site-checks)             | Verify built static sites against their page inventory, canonical URLs, links, sitemaps, robots.txt, and llms.txt.                    |
| [`jg-package-check`](packages/jg-package-check)         | Inspect npm tarballs and check packed exports in disposable npm or pnpm consumers.                                                    |
| [`jg-publishing-guides`](packages/jg-publishing-guides) | Render offline HTML and plain-text publishing guides with literal copy, ordered files, and localized controls.                        |

[`jg-personal-astro-ui`](packages/jg-personal-astro-ui) is also published from `packages/`: the Astro components and theme Jesus Graterol's own sites share. It isn't meant for general use, so the website doesn't list it.

`jg-personal-ui` owns the tokens, fonts, and mark artwork shared by `jg-personal-astro-ui` and `jg-personal-react-ui`. `jg-react-ui` supplies the shared React implementations. They are published for personal use and excluded from the website catalog. See [`docs/personal-ui.md`](docs/personal-ui.md) for package ownership and the private React gallery.

General-purpose packages get a row here when added to `packages/`.

## License

[MIT](LICENSE)
