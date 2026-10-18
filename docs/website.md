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

`build` runs `astro build`, then `verify-build` on the result, so a build that breaks one of [its checks](#build-checks) fails. The site's integration tests run `verify-build` against copies of that build, each broken in one way, so `pnpm check` builds the site before them.

## Where the content comes from

| Content             | Source                                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The package list    | `PACKAGE_CATALOG` in `website/src/site.config.ts`: each package's title, description, icon, runtimes, and position. Names and versions come from `package.json`.                             |
| A package's README  | `packages/<name>/README.md`, loaded by the `packageReadmes` collection without the title, the summary, and the Install, Documentation, and License sections, which the page shows elsewhere. |
| A package's recipes | `packages/<name>/RECIPES.md`, loaded by the `packageRecipes` collection without its title, which the recipes page shows in its header. A listed package without one fails the build.         |
| The API reference   | `website/src/generated/api/<name>.json`, which `generate` writes from each package's TSDoc. It's ignored by Git.                                                                             |

The build fails when the catalog and `packages/` disagree: every published package needs an entry except those in `UNLISTED_PACKAGES` (`jg-personal-astro-ui`), orders and icons must be unique, and descriptions must be 70 to 160 characters. `generate` fails when an export has no TSDoc.

## Pages

| Path                        | What it shows                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                         | The home page, in the sections below                                                                                                                                     |
| `/packages/<name>/`         | The package's header, with its install command and a "Recipes" button, its README, its API reference, and a table of contents                                            |
| `/packages/<name>/recipes/` | The package's recipes, each block in a code window with a copy button, under a breadcrumb and a link back to the package's page, with a table of contents of the recipes |
| `/404.html`                 | A page-not-found page, `noindex` and without a canonical URL, linking back to the home page and the packages                                                             |

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

## Markdown versions and files for agents

Every page has a Markdown version at `index.md` in its directory, which its head links as `<link rel="alternate" type="text/markdown">`. Every page's head also links `/llms.txt` as `describedby`.

| Path                                | What it serves                                                                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/index.md`                         | The home page, section by section, with each package linked to its Markdown version. It reads the same words as the page, from `src/utilities/home-content/`.                                          |
| `/packages/<name>/index.md`         | The package's header (description, version, runtimes, install command, and its npm, source, and recipes links), its README's sections as the page shows them, and its API reference at heading level 2 |
| `/packages/<name>/recipes/index.md` | The package's `RECIPES.md`, as it ships                                                                                                                                                                |
| `/llms.txt`                         | The site's index in the [llmstxt.org](https://llmstxt.org/) format: the agent setup links, then every package's and every recipes page's Markdown version                                              |
| `/llms-full.txt`                    | Every package's Markdown version and recipes in one file, for loading into a context window                                                                                                            |
| `/robots.txt`                       | Lets every crawler read the site, and names the sitemap index                                                                                                                                          |

The sitemap lists the HTML pages only. A recipes page's description is the sentence under its `RECIPES.md` title when it fits search results, 70 to 160 characters, and otherwise names the recipes.

**Head data.** `base-layout` gives every page its canonical URL, its Markdown version, the `llms.txt` link, the open-graph image, and the JSON-LD from `buildStructuredData` in `jg-personal-astro-ui/seo`: the home page is the `WebSite`, with an `ItemList` of the package pages; every other page is a `WebPage` with its `BreadcrumbList`, and a package page adds its `SoftwareSourceCode`.

**The open-graph image** is `public/og/jg-packages.png`, 1200 by 630, committed. `pnpm --filter @jg-packages/website assets:generate` writes it again from `scripts/open-graph-template.html`, in Chromium, listing every package in the catalog. Run it after changing the template or the catalog.

## Build checks

`scripts/verify-build.ts` runs `verifyBuild` from `src/utilities/verify-build/` on `dist`. The first failure stops the build with one of these messages:

| Message                                                                                                              | What it means, and how to fix it                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing build path                                                                                                   | A required file is missing: the home page, the 404 page, the favicon, `llms.txt`, `llms-full.txt`, `robots.txt`, the sitemap index, or the open-graph image. Restore its route or file.                                    |
| Production build contains a test file                                                                                | A test file reached `public/` or the build. Move it out.                                                                                                                                                                   |
| Missing package page                                                                                                 | A listed package lacks its page, its recipes page, or one of their Markdown versions. A new catalog entry needs the package's README and `RECIPES.md`.                                                                     |
| Page holds an event handler or a URL with a disallowed scheme                                                        | Markup has an `on…` attribute, or a URL with a scheme other than `http`, `https`, or `mailto`. Scripts and styles are skipped. Remove it.                                                                                  |
| Page repeats an element ID                                                                                           | Two elements share an ID, such as two API symbols with one anchor. Make them unique.                                                                                                                                       |
| Missing required metadata                                                                                            | A public page lacks one of the head tags `base-layout` writes, such as its canonical URL, its Markdown alternate, or an open-graph tag. Render the page through `base-layout` with its `canonicalPath` and `markdownPath`. |
| Page has no Markdown version                                                                                         | The `index.md` next to a page is missing. Add its route.                                                                                                                                                                   |
| Missing or duplicate page title, or description                                                                      | Two pages share a title or a description. Make each unique.                                                                                                                                                                |
| Page title is longer than 60 characters                                                                              | Shorten the title.                                                                                                                                                                                                         |
| Page description is not 70 to 160 characters long                                                                    | Rewrite the description to fit. The catalog checks package descriptions the same way.                                                                                                                                      |
| Canonical URL is missing from the sitemap                                                                            | A public page isn't in the sitemap. Check the sitemap integration's settings in `astro.config.ts`.                                                                                                                         |
| Missing structured data, Invalid structured data, Structured data is not an object, Structured data graph is invalid | The page's JSON-LD is missing or malformed. Pass `structuredData` from `buildStructuredData` to `base-layout`.                                                                                                             |
| Structured data does not match the canonical page                                                                    | The JSON-LD describes another URL, or has no description.                                                                                                                                                                  |
| Home page item list does not list every package                                                                      | The home page's `ItemList` and the catalog disagree.                                                                                                                                                                       |
| Breadcrumb hierarchy is incomplete                                                                                   | A page's `BreadcrumbList` doesn't end at the page, or the page shows no `<nav aria-label="Breadcrumb">`. Keep the JSON-LD and the visible breadcrumb in step.                                                              |
| Package page is missing its source code entity                                                                       | A package page's JSON-LD lacks its `SoftwareSourceCode`.                                                                                                                                                                   |
| Broken internal link                                                                                                 | A link to this site reaches no file of the build.                                                                                                                                                                          |
| Fragment link has no matching element ID                                                                             | A link's `#fragment` matches no element of the page it points to.                                                                                                                                                          |
| The 404 page must stay out of search indexes, or must not name a canonical URL                                       | The 404 page lost its `noIndex`, or gained a canonical URL.                                                                                                                                                                |
| robots.txt does not name the sitemap index                                                                           | Restore the `Sitemap:` line in `src/pages/robots.txt.ts`.                                                                                                                                                                  |
| llms.txt does not follow the required structure                                                                      | `llms.txt` lacks its title and summary, the agent setup links, or a package's or recipes page's link.                                                                                                                      |
| Broken internal llms.txt link                                                                                        | A link in `llms.txt` reaches no file of the build.                                                                                                                                                                         |
| llms-full.txt is missing a package or its recipes                                                                    | A package's Markdown version or its `RECIPES.md` is missing from `llms-full.txt`.                                                                                                                                          |
| The build names a package the site never mentions                                                                    | A text file names one of the packages the jg packages replaced, or one kept off the site, such as `jg-personal-astro-ui`. `OLD_PACKAGE_NAMES` in `src/utilities/verify-build/constants.ts` lists the old ones. Reword it.  |

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
