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
| The package list   | `PACKAGE_CATALOG` in `website/src/site.config.ts`: each package's title, description, icon, runtimes, and position. Names and versions come from `package.json`.                             |
| A package's README | `packages/<name>/README.md`, loaded by the `packageReadmes` collection without the title, the summary, and the Install, Documentation, and License sections, which the page shows elsewhere. |
| The API reference  | `website/src/generated/api/<name>.json`, which `generate` writes from each package's TSDoc. It's ignored by Git.                                                                             |

The build fails when the catalog and `packages/` disagree: every published package needs an entry except those in `UNLISTED_PACKAGES` (`jg-personal-astro-ui`), orders and icons must be unique, and descriptions must be 70 to 160 characters. `generate` fails when an export has no TSDoc.

## Pages

| Path                | What it shows                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `/`                 | The home page, in the sections below                                                             |
| `/packages/<name>/` | The package's header and install command, its README, its API reference, and a table of contents |

The home page's sections, in order:

1. **The hero:** what coding agents gain, the two actions "Set up your agent" and "View all packages", and the packages as icon tiles, from `package-grid`. It shows the first 8, so the hero keeps its shape as packages are added, and below them a "View all <count> packages" link, with a down arrow, to the packages section.
2. **The packages** (`#packages`), grouped by their first runtime.
3. **Why agents use them** (`#why`): six benefits, which also cover how the packages are built.
4. **Set up your agent** (`#setup`): the two steps from `agent-setup`, described below.
5. **Docs for agents** (`#agents`): what agents can read, each linked once the site serves it.

### Agent setup

A project connects to the packages through [jg-skills](https://jg-skills.jesusgraterol.dev/), in two steps:

1. **The policy:** a `## jg-packages` section for the project's `AGENTS.md`, telling its agent to prefer these packages and to check the installed version's `API.md`. The section links to it.
2. **The skill:** `jg-packages`, which tells the agent which package fits a task. The section shows its install command, in a code window with a copy button.

`SITE_CONFIG.agentSetup` holds the three destinations: `policyUrl`, `skillUrl` and `installCommand`. jg-skills owns all three, so a change there is one edit here. How package changes keep jg-skills current is in [Keeping jg-skills in sync](package-guidelines.md#keeping-jg-skills-in-sync).

**The launch order,** so no link points at a page that isn't live:

1. jg-skills publishes its skill page and policy, and its Pages deploy finishes.
2. This site launches, after checking that both destinations answer with the expected page and file.
3. jg-skills publishes its home page section, which links here.

### Navigation

Pages crossfade into each other, and a page is prerendered when the pointer rests on its link, both from `jg-personal-astro-ui` without JavaScript. When a page is slow to arrive, the layout's `navigation-progress` shows a thin bar along the top until it does. [`personal-astro-ui.md`](personal-astro-ui.md#navigation) describes all three. Judge how navigation feels on the built site, through `pnpm --filter @jg-packages/website preview`: the dev server loads unbundled modules on every page.

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

Add its entry to `PACKAGE_CATALOG`, with a description of 70 to 160 characters, and a `"jg-<name>": "workspace:*"` devDependency to `website/package.json`, so the site rebuilds when the package changes. A package that should stay off the site goes in `UNLISTED_PACKAGES` instead.
