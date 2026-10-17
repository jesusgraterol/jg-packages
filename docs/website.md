# Website

How the site at [jg-packages.jesusgraterol.dev](https://jg-packages.jesusgraterol.dev) is built from the packages, and how to work on it. It lives in `website/` as the private `@jg-packages/website` workspace package, an Astro site built from [`jg-personal-astro-ui`](personal-astro-ui.md).

## Running it

Run the site's tasks through Turborepo, so the packages build and the API reference is generated first:

```bash
pnpm turbo run dev --filter=@jg-packages/website
pnpm turbo run build --filter=@jg-packages/website
pnpm --filter @jg-packages/website preview
```

`dev` serves the site at `http://localhost:4321/` and reloads when a README or a component changes. Running `astro dev` or `astro build` directly skips `generate`, and the package pages then fail with "has no API reference".

## Where the content comes from

| Content            | Source                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The package list   | `PACKAGE_CATALOG` in `website/src/site.config.ts`: each package's title, description, icon, runtimes, the packages it replaces, and its position. Names and versions come from `package.json`. |
| A package's README | `packages/<name>/README.md`, loaded by the `packageReadmes` collection without the title, the summary, and the Install, Documentation, and License sections, which the page shows elsewhere.   |
| The API reference  | `website/src/generated/api/<name>.json`, which `generate` writes from each package's TSDoc. It's ignored by Git.                                                                               |

The build fails when the catalog and `packages/` disagree: every published package needs an entry except those in `UNLISTED_PACKAGES` (`jg-personal-astro-ui`), and orders and icons must be unique. `generate` fails when an export has no TSDoc.

## Pages

| Path                | What it shows                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`                 | What the packages are, the catalog grouped by runtime, the conventions they share, a migration example, and agent docs |
| `/packages/<name>/` | The package's header and install command, its README, its API reference, and a table of contents                       |

## Package icons

Every package has one icon, set as `icon` in its catalog entry. It leads the package's card and opens its page, drawn in one theme color on the dark tile, as on [JG Skills](https://jg-skills.jesusgraterol.dev/).

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

To add one, confirm the icon exists as `website/node_modules/@lucide/astro/src/icons/<name>.ts`, add its key to `IPackageIcon` in `website/src/utilities/package-catalog/types.ts`, map it to its component in `website/src/components/package-icon/package-icon.astro`, set the package's `icon`, and add its row here.

## Listing a new package

Add its entry to `PACKAGE_CATALOG`, with a description of 70 to 160 characters, and a `"jg-<name>": "workspace:*"` devDependency to `website/package.json`, so the site rebuilds when the package changes. A package that should stay off the site goes in `UNLISTED_PACKAGES` instead.
