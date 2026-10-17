# Website

How the site at [jg-packages.jesusgraterol.dev](https://jg-packages.jesusgraterol.dev) is built from the packages, and how to work on it. It lives in `website/` as the private `@jg-packages/website` workspace package, an Astro site built from [`jg-personal-astro-ui`](personal-astro-ui.md).

## Running it

Run the site's tasks through Turborepo, so the packages build and the API reference is generated first:

```bash
pnpm dev
pnpm turbo run build --filter=@jg-packages/website
pnpm --filter @jg-packages/website preview
```

`pnpm dev` runs the site's `dev` task through Turborepo. It serves the site at `http://localhost:4321/` and reloads when a README or a component changes. Running `astro dev` or `astro build` directly skips `generate`, and the package pages then fail with "has no API reference".

## Where the content comes from

| Content            | Source                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The package list   | `PACKAGE_CATALOG` in `website/src/site.config.ts`: each package's title, description, `useWhen`, icon, runtimes, and position. Names and versions come from `package.json`.                  |
| A package's README | `packages/<name>/README.md`, loaded by the `packageReadmes` collection without the title, the summary, and the Install, Documentation, and License sections, which the page shows elsewhere. |
| The API reference  | `website/src/generated/api/<name>.json`, which `generate` writes from each package's TSDoc. It's ignored by Git.                                                                             |

The build fails when the catalog and `packages/` disagree: every published package needs an entry except those in `UNLISTED_PACKAGES` (`jg-personal-astro-ui`), orders and icons must be unique, descriptions must be 70 to 160 characters, and each `useWhen` 40 to 140. `generate` fails when an export has no TSDoc.

## Pages

| Path                | What it shows                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `/`                 | The home page, in the sections below                                                             |
| `/packages/<name>/` | The package's header and install command, its README, its API reference, and a table of contents |
| `/agents.md`        | The AGENTS.md block for every package, as Markdown                                               |

The home page's sections, in order:

1. **The hero:** what coding agents gain, the two actions "Add them to your AGENTS.md" and "View all packages", and every package as an icon tile, from `package-grid`.
2. **The packages** (`#packages`), grouped by their first runtime.
3. **Why agents use them** (`#why`): six benefits, which also cover how the packages are built.
4. **Add them to your AGENTS.md** (`#agents-md`): the picker from `agents-block`. Every package starts checked; its script rebuilds the preview, a code window, as packages are checked and unchecked, and the window's copy button copies exactly the preview.
5. **Docs for agents** (`#agents`): what agents can read, each linked once the site serves it.

### The AGENTS.md block

`src/utilities/agents-block` builds it, at build time for the page and `/agents.md`, and in the browser for the picker, so the two never differ. It opens with a `## jg-packages` heading and an instruction to prefer the packages and read each one's `API.md`, then lists one line per package: its name, its `useWhen`, and the URL of its page's Markdown.

## Package icons

Every package has one icon, set as `icon` in its catalog entry. It leads the package's card and opens its page, drawn in one theme color on the dark tile, as on [jg-skills](https://jg-skills.jesusgraterol.dev/).

- A package written for one technology would use that technology's mark. None of the current packages is, so all of them use a [Lucide](https://lucide.dev/icons/) icon.
- Pick one idea, named for what the package is for. It must read at 20 pixels, and differ from every other package's icon; the build rejects a repeat.

| Package           | Icon           | Why                             |
| ----------------- | -------------- | ------------------------------- |
| `jg-exception`    | `OctagonAlert` | Errors.                         |
| `jg-api-response` | `Braces`       | JSON envelopes.                 |
| `jg-utilities`    | `Wrench`       | General-purpose helpers.        |
| `jg-bignumber`    | `Calculator`   | Exact decimal math.             |
| `jg-fetch`        | `Globe`        | Requests over the network.      |
| `jg-storage`      | `Database`     | Key-value stores.               |
| `jg-sw`           | `CloudOff`     | Apps that keep working offline. |
| `jg-fs`           | `FolderOpen`   | Files and directories.          |
| `jg-process`      | `Cpu`          | Child processes.                |
| `jg-clipboard`    | `Clipboard`    | Copying and pasting.            |

To add one, confirm the icon exists as `website/node_modules/@lucide/astro/src/icons/<name>.ts`, add its key to `IPackageIcon` in `website/src/utilities/package-catalog/types.ts`, map it to its component in `website/src/components/package-icon/package-icon.astro`, set the package's `icon`, and add its row here.

## Listing a new package

Add its entry to `PACKAGE_CATALOG`, with a description of 70 to 160 characters and a `useWhen` of 40 to 140, one sentence that starts "Use" and says when an agent should reach for the package, and a `"jg-<name>": "workspace:*"` devDependency to `website/package.json`, so the site rebuilds when the package changes. A package that should stay off the site goes in `UNLISTED_PACKAGES` instead.
