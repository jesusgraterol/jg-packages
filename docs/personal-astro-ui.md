# jg-personal-astro-ui

The Astro components, Tailwind CSS token contract, and theme that Jesus Graterol's sites share, published as `jg-personal-astro-ui`. Four sites are built from it: this repository's [website](website.md), [jesusgraterol.dev](https://jesusgraterol.dev), [Agentic Coding](https://agenticcoding.jesusgraterol.dev), and [jg-skills](https://jg-skills.jesusgraterol.dev). It stays unlisted on the site, and its API can change in any `0.x` release.

## Setting up a site

Install it with its peers, and Astro's Markdown processor, at the version your `astro` depends on, for the code windows in Markdown:

```bash
npm install jg-personal-astro-ui astro tailwindcss @tailwindcss/vite @astrojs/markdown-satteri
```

Add the Tailwind CSS Vite plugin, the package's syntax theme for Markdown code, and `codeWindowPlugin`, which puts every Markdown code block in a code window, in `astro.config.ts`:

```ts
import { satteri } from '@astrojs/markdown-satteri';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { codeWindowPlugin } from 'jg-personal-astro-ui/code-window-plugin';
import { SYNTAX_THEME } from 'jg-personal-astro-ui/syntax-theme';

export default defineConfig({
  markdown: {
    shikiConfig: { theme: SYNTAX_THEME },
    processor: satteri({ hastPlugins: [codeWindowPlugin] }),
  },
  vite: { plugins: [tailwindcss()] },
});
```

`codeWindowPlugin` is a hast plugin for Sätteri, the processor Astro uses by default, not a rehype plugin: Astro runs rehype plugins only on its older `unified` processor.

To open the Markdown's links to other sites in a new tab, as the components do, add `externalLinkPlugin({ siteUrl })` from `jg-personal-astro-ui/external-link-plugin` after it, with the site's URL. It gives every absolute `http` or `https` link to another origin `target="_blank"`, `rel="noreferrer"`, and the new-tab marker. A link that already has a target keeps it, and links written as HTML in the Markdown stay as written.

Import the stylesheets in the site's global stylesheet, in this order:

```css
@import 'tailwindcss';
@import 'jg-personal-astro-ui/styles/contract.css';
@import 'jg-personal-astro-ui/styles/theme.css';
@import 'jg-personal-astro-ui/styles/prose.css';
```

Then render `DocumentHead` and `ThemeInitScript` in every page's `<head>`, so the theme applies before the first paint, and render Markdown inside `prose`, which loads what makes the code windows' copy buttons work. `website/src/layouts/base-layout.astro` is a complete layout.

## The token contract

`contract.css` maps `--jg-*` custom properties to Tailwind CSS theme values, so components use utilities such as `bg-surface` and `text-muted`. It also defines the `dark` variant, which follows the `.dark` class the theme script sets on `<html>`, and the shared classes `eyebrow`, `display-title`, `section-title`, `lede`, `jg-container`, `jg-container-prose`, `jg-section-space`, `jg-hero-backdrop`, `jg-code`, and the code window's `jg-code-window`, `jg-code-window-header`, `jg-code-window-dots`, and `jg-code-window-caption`.

`theme.css` gives every property its value, in a light palette on `:root` and a dark one on `.dark`, with the system preference deciding until the theme script runs. Code windows stay dark in both themes, so it also gives `.jg-code-window` the dark palette's `--jg-syntax-*` values. Components use only the contract, so a site can replace `theme.css` with its own, as long as it defines every property and the code window's syntax colours.

| Properties                                                          | Tailwind CSS utilities                                  | What they're for                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `--jg-background`, `--jg-foreground`                                | `bg-background`, `text-foreground`                      | The page and its text                                                 |
| `--jg-surface`, `--jg-secondary`                                    | `bg-surface`, `bg-secondary`                            | Cards and panels, and hover and muted fills                           |
| `--jg-muted`                                                        | `text-muted`                                            | Secondary text                                                        |
| `--jg-border`, `--jg-border-strong`                                 | `border-border`, `border-border-strong`                 | Hairlines, and borders that need contrast                             |
| `--jg-primary`, `--jg-primary-foreground`                           | `bg-primary`, `text-primary-foreground`                 | Primary buttons and icon tiles; near-black in light, inverted in dark |
| `--jg-accent`, `--jg-accent-foreground`                             | `text-accent`, `bg-accent`                              | The teal accent                                                       |
| `--jg-terminal`, `--jg-terminal-foreground`, `--jg-terminal-accent` | `bg-terminal`, …                                        | Terminal panels, dark in both themes                                  |
| `--jg-inverse`, `--jg-inverse-foreground`, `--jg-inverse-accent`    | `bg-inverse`, `text-inverse-foreground`, …              | Panels that stay dark in both themes, such as a contact band          |
| `--jg-focus`                                                        | `outline-focus`                                         | Focus rings                                                           |
| `--jg-code`                                                         | `bg-code`                                               | Code blocks and inline code                                           |
| `--jg-success`, `--jg-warning`, `--jg-danger`                       | `bg-success`, `text-warning`, …                         | Statuses                                                              |
| `--jg-diff-added`, `--jg-diff-removed`                              | `bg-diff-added`, `bg-diff-removed`                      | Diff lines                                                            |
| `--jg-font-sans`, `--jg-font-mono`                                  | `font-sans`, `font-mono`                                | Ubuntu Sans and Ubuntu Sans Mono                                      |
| `--jg-radius`                                                       | `rounded-sm` to `rounded-2xl`                           | The base radius the others scale from                                 |
| `--jg-page-width`, `--jg-prose-width`, `--jg-page-gutter`           | `max-w-page`, `px-page`, and the `jg-container` classes | The page column, the reading column, and the side gutter              |
| `--jg-section-space`                                                | `py-section`                                            | The space between home page sections                                  |
| `--jg-shadow-surface`, `--jg-shadow-raised`                         | `shadow-surface`, `shadow-raised`                       | Resting cards, and floating panels                                    |
| `--jg-syntax-*`                                                     | none                                                    | Code colours, read by the syntax theme                                |

## Components

Each component is its own subpath, such as `jg-personal-astro-ui/button`. Most take a `class` prop for layout classes on their root element; the page frame (`skip-link`, `site-header`, and `site-footer`) and the head components don't.

| Component              | What it renders                                                                                                                                                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document-head`        | The title, description, canonical URL, robots, Open Graph and X tags, JSON-LD, icons, and agent links; `openGraphType` with its `article:*` or `profile:*` tags, and an `alternate` version of the page                                                                                                                                      |
| `new-tab-marker`       | The arrow and screen-reader notice that end a link opening a new tab, with `data-new-tab-marker` on the arrow                                                                                                                                                                                                                                |
| `theme-init-script`    | The inline script that applies the stored or system theme before the first paint                                                                                                                                                                                                                                                             |
| `skip-link`            | A "Skip to main content" link that shows on focus                                                                                                                                                                                                                                                                                            |
| `site-header`          | The sticky header: brand, navigation, search at every width, actions, and a menu on narrow screens; items take `external` and `match: 'prefix'`, and `trackSections` marks the item of the section the reader is in                                                                                                                          |
| `site-footer`          | The footer: brand, about text, link columns, and notes, in one row on wide screens however many columns                                                                                                                                                                                                                                      |
| `theme-control`        | The light and dark switch, which stores the choice                                                                                                                                                                                                                                                                                           |
| `brand-logo`           | The site's name beside the mark the site supplies, with an optional `tagline` on a second line                                                                                                                                                                                                                                               |
| `jg-mark`              | The lowercase `jg/` mark, in fixed colors, decorative; `./jg-mark.svg` is the same mark as a file, for a site's social images, and `./jg-favicon.svg` is its slash alone, for the favicon                                                                                                                                                    |
| `agentic-coding-mark`  | The Agentic Coding mark, two code chevrons meeting at a node, in fixed colors, decorative; `./agentic-coding-mark.svg` is the same mark as a file, for agenticcoding's favicon and social images                                                                                                                                             |
| `container`, `section` | The page and reading columns, and a home page section with its eyebrow, title, and lede: stacked, centered with `align="center"`, or split into the eyebrow beside the title and lede with `layout="split"`, plus a `header-end` slot after the lede                                                                                         |
| `stack`                | Its children in one column, evenly spaced, as a div, a list, or a section                                                                                                                                                                                                                                                                    |
| `page-header`          | An inner page's header over the hero backdrop: a breadcrumb, a mark in its `leading` slot, an eyebrow, the title, a lede, and actions; `align="center"` centers it, its breadcrumb included                                                                                                                                                  |
| `hero-backdrop`        | The jg sites' hero backdrop: a faint dot lattice under a soft accent glow                                                                                                                                                                                                                                                                    |
| `navigation-progress`  | The page-loading bar along the top of the viewport, shown when the next page is slow to arrive                                                                                                                                                                                                                                               |
| `breadcrumb`           | A trail of links, ending at the current page, at the start of its column or centered with `align`                                                                                                                                                                                                                                            |
| `icon-tile`            | A primary square holding an icon, sized `card` or `header`, which sizes the icon in its slot and inverts in dark mode                                                                                                                                                                                                                        |
| `button`, `text-link`  | Pill buttons and links, with variants and sizes, and an arrow and the new-tab notice on external links; `button` has an `inverse` variant for the inverse surface and takes link attributes such as `download`, and `text-link` passes other attributes on                                                                                   |
| `badge`                | A small label, with status variants, with a `neutral` variant, a status `dot`, and `mono={false}` for the page font; passes other attributes on                                                                                                                                                                                              |
| `link-card`            | A card whose whole area is one link, with icon, meta, and footer slots; `external` opens another site with an arrow in the corner, a `kicker` slot sits above the title, and other attributes pass on                                                                                                                                        |
| `card`                 | A raised surface for one item, as a div, an article, a section, or a list item; passes other attributes on                                                                                                                                                                                                                                   |
| `prose`                | Rendered Markdown in the shared reading style; passes other attributes on                                                                                                                                                                                                                                                                    |
| `inline-code`          | Code in a sentence that wraps only after `/`, `_`, `.`, and `-`, so a long path or name breaks at its separators                                                                                                                                                                                                                             |
| `kbd`                  | A key, such as `/` or `K`; a shortcut is several                                                                                                                                                                                                                                                                                             |
| `table`                | A data table with an optional caption, which scrolls sideways on its own when it's wider than the page; `scrollLabel` makes it a labelled region keyboard users can focus, `captionHidden` hides the caption from sight, and `stickyFirstColumn` pins each row's first cell                                                                  |
| `callout`              | A boxed aside, as a note, a tip, a warning, or a danger, with an optional title; `role="note"` marks one as a note in ARIA's sense                                                                                                                                                                                                           |
| `code-block`           | A code window: highlighted code on the dark terminal surface, with window dots, a caption, and copying                                                                                                                                                                                                                                       |
| `code-diff`            | Two versions of code as a diff: unified on narrow screens, side by side on wide ones                                                                                                                                                                                                                                                         |
| `terminal-window`      | The code window's frame around a shell session or output, with a copy button for an element when given its id; `wrapTitle` lets a long title wrap                                                                                                                                                                                            |
| `install-command`      | One shell command after a `$` prompt, in a terminal window under a title that wraps, with a copy button that copies the command alone, named by `context`, as in "Copy install command"                                                                                                                                                      |
| `copy-button`          | A button that copies text, an element, or the text at a `url`, such as a page's Markdown version, with `jg-clipboard`, and says what to do when the browser refuses, for each reason, linking to the `url`'s text; its box stays the same while its label changes to "Copied" or "Copy failed", and it comes in `sm` and `md` sizes          |
| `tabs`                 | ARIA tabs, with arrow keys, Home and End, and an optional remembered choice                                                                                                                                                                                                                                                                  |
| `segmented-control`    | A radio group drawn as a segmented pill, with a legend that `legendHidden` hides from sight; it works without JavaScript, and each radio's `data-segment="<value>"` lets the section around it toggle its own content with `group-has-[[data-segment=<value>]:checked]/<group>:` variants. Values are lowercase letters, digits, and hyphens |
| `dialog`               | A modal dialog, titled by its heading, with a close button: any element with `data-dialog-open` set to its id opens it, Escape, the close button, and a click outside close it, and focus returns to what opened it                                                                                                                          |
| `search-dialog`        | A search button and its dialog, which `/` and Ctrl+K or Cmd+K open too, and one Escape closes. Typing searches the site with [Pagefind](https://pagefind.app/), loaded from `pagefindPath`, and lists up to 8 results                                                                                                                        |
| `package-manager-tabs` | An install command for npm and pnpm in a terminal panel, with the choice remembered across the site                                                                                                                                                                                                                                          |

Only `theme-control`, the copy buttons, `tabs`, `dialog`, `search-dialog`, the header's menu, and `navigation-progress` run JavaScript in the browser, besides the theme script. Dialogs, like copy buttons, share one click listener on the document; `search-dialog` adds one key listener for its shortcut and one input listener. Copy buttons come from `copy-button`, `code-block`, `terminal-window`, `install-command`, and the code windows in Markdown, which `prose` makes work; one click listener on the document serves them all, however many there are.

Code window headers and copy buttons carry `data-pagefind-ignore`, so a site's Pagefind excerpts show its content rather than "Copy" or a language name.

External links show an arrow after their text. On a `button`, `externalIcon={false}` hides it, and so does `externalIcon: false` on a `site-footer` link; the jg-packages site does that on the links to its own repository.

## Navigation

Every page the package's components build crossfades into the next, and prerenders when the pointer rests on its link, without JavaScript:

- `contract.css` turns on cross-document view transitions with `@view-transition { navigation: auto; }`, with a 180 ms crossfade, and turns them off under `prefers-reduced-motion: reduce`.
- `site-header` carries `view-transition-name: jg-site-header`, so the header stays still while the page under it changes. The footer moves with the page, because its position differs from page to page.
- `document-head` adds a `<script type="speculationrules">`, JSON the browser reads rather than code it runs. It prerenders same-site pages with `moderate` eagerness, which waits for the pointer to rest on a link, and never links to `.md`, `.txt`, `.xml` or `.png` files.

Chromium supports both, Safari only the transitions, and Firefox neither; where a browser doesn't, pages load as they always did.

`navigation-progress` covers the pages that are slow to arrive. A site's layout renders it once, and its script listens for clicks on the document:

- **When it shows:** 150 ms after a primary-button click, without modifier keys, on a link to another page of the same site in the same tab: no `target` but `_self`, no `download`, and more than a jump within the current page. A click a script already handled doesn't count. Prerendered and fast pages arrive first, so the bar never flashes on them.
- **When it hides:** the next page replaces it, a page restored from the back/forward cache hides it, and so does a 15-second stall, such as a link that downloaded a file.
- **Its look:** a 4 px bar in `--jg-foreground` on `--jg-background`, whose indicator sweeps across once a second. Under `prefers-reduced-motion: reduce` it's a still bar a third wide.
- **What it can't see:** the back and forward buttons, a typed URL, and a form submission load pages without a click it catches; the browser's own loading indicator covers them.

## Modules

| Subpath                                      | What it exports                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jg-personal-astro-ui/code-window`           | `renderCodeWindowHeader`, the markup of a code window's header, for a site whose build checks allow only the markup Markdown produces               |
| `jg-personal-astro-ui/code-window-plugin`    | `codeWindowPlugin`, the Sätteri hast plugin that puts Markdown code blocks in code windows                                                          |
| `jg-personal-astro-ui/external-link-plugin`  | `externalLinkPlugin`, the Sätteri hast plugin that opens Markdown links to other sites in a new tab, with `rel="noreferrer"` and the new-tab marker |
| `jg-personal-astro-ui/new-tab-marker-markup` | `renderNewTabMarker`, the markup that ends a link opening a new tab, and `NEW_TAB_NOTICE`, its screen-reader text                                   |
| `jg-personal-astro-ui/syntax-theme`          | `SYNTAX_THEME`, the Shiki theme that colours code with the `--jg-syntax-*` properties                                                               |

A page's JSON-LD (`buildStructuredData`, `serializeStructuredData`, and `SEARCH_TEXT_LIMITS`), llms.txt (`buildLlmsText` and `buildLlmsFullText`), and the stored theme preference come from [jg-site](../packages/jg-site/README.md), which the components use too. The events between `theme-control` and `theme-init-script` stay inside the package.

## Private gallery

The repository's `packages/jg-personal-astro-ui/gallery/` renders the public component inventory across foundations, interactions, documentation, and technical content pages. `gallery/src/catalog/` maps each Astro export to a rendered example. Examples import only public package subpaths; the token contract detects component classes from the installed package and the gallery stylesheet detects its own templates. Markdown examples execute the Sätteri plugins, and the build creates a real Pagefind index.

```bash
pnpm --filter jg-personal-astro-ui gallery:dev
pnpm --filter jg-personal-astro-ui gallery:build
pnpm --filter jg-personal-astro-ui test:integration
pnpm --filter jg-personal-astro-ui test:e2e
```

The E2E suite serves the build only at `http://127.0.0.1:4332/`, refuses to reuse an existing server, and runs all three browser engines. Its preview wrapper owns Astro's child process tree and stops it on stdin EOF, SIGINT, SIGTERM, or child failure. `JG_UI_GALLERY_ROOT` optionally selects an absolute consumer root with its own installed Astro and built gallery; it is a local verification override. Default preview resolution uses this package's development installation. Global `NODE_PATH` entries never supply Astro for a selected consumer.

The preview integration tests exercise real CLI/descendant teardown in a temporary consumer without a pre-existing build. `test:coverage` includes unit and integration tests; `test` additionally runs browser tests and gallery E2E. Package typechecking includes the private gallery. The package-local Turbo graph serializes typechecking after the package build and E2E after typechecking to avoid concurrent Astro syncs.

The gallery stays out of the public website's routes and catalog, the npm allowlist, and deployed website output. Its examples cover the current supported behavior; the gallery is a verification tool rather than a public documentation site.

The light theme's keyword color maintains readable contrast on both added and removed diff backgrounds. Gallery axe checks cover these rendered syntax tokens in both themes.

## Releasing it

It's checked like every other package, plus the rendered gallery: `release:verify` copies the maintained gallery into an isolated consumer, installs the exact UI and required sibling tarballs with the checked-in tool versions, builds its pages and Pagefind index, and runs the same Playwright scenarios in all three browser engines. The fixture checks the packed export inventory and owns bounded commands, shutdown, and cleanup. [`releasing.md`](releasing.md) covers its limits and failure handling.
