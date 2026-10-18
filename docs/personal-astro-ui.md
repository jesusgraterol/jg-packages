# jg-personal-astro-ui

The Astro components, Tailwind CSS token contract, and theme that Jesus Graterol's sites share, published as `jg-personal-astro-ui`. This repository's [website](website.md) is built from it. It stays unlisted on the site, and its API can change in any `0.x` release.

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
| `--jg-terminal`, `--jg-terminal-foreground`, `--jg-terminal-accent` | `bg-terminal`, …                                        | Terminal panels and the `JG/` tile, dark in both themes               |
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

| Component              | What it renders                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document-head`        | The title, description, canonical URL, robots, Open Graph and X tags, JSON-LD, favicon, and agent links                                                                                                               |
| `theme-init-script`    | The inline script that applies the stored or system theme before the first paint                                                                                                                                      |
| `skip-link`            | A "Skip to main content" link that shows on focus                                                                                                                                                                     |
| `site-header`          | The sticky header: brand, navigation, search at every width, actions, and a menu on narrow screens                                                                                                                    |
| `site-footer`          | The footer: brand, about text, link columns, and notes, in one row on wide screens however many columns                                                                                                               |
| `theme-control`        | The light and dark switch, which stores the choice                                                                                                                                                                    |
| `brand-logo`           | The site's name beside the mark the site supplies                                                                                                                                                                     |
| `container`, `section` | The page and reading columns, and a home page section with its eyebrow, title, and lede                                                                                                                               |
| `stack`                | Its children in one column, evenly spaced, as a div, a list, or a section                                                                                                                                             |
| `page-header`          | An inner page's header over the hero backdrop: a breadcrumb, a mark in its `leading` slot, an eyebrow, the title, a lede, and actions                                                                                 |
| `hero-backdrop`        | The jg sites' hero backdrop: a faint dot lattice under a soft accent glow                                                                                                                                             |
| `navigation-progress`  | The page-loading bar along the top of the viewport, shown when the next page is slow to arrive                                                                                                                        |
| `breadcrumb`           | A trail of links, ending at the current page                                                                                                                                                                          |
| `button`, `text-link`  | Pill buttons and links, with variants and sizes, and an arrow and the new-tab notice on external links                                                                                                                |
| `badge`                | A small label, with status variants                                                                                                                                                                                   |
| `link-card`            | A card whose whole area is one link, with icon, meta, and footer slots                                                                                                                                                |
| `card`                 | A raised surface for one item, as a div, an article, a section, or a list item                                                                                                                                        |
| `prose`                | Rendered Markdown in the shared reading style                                                                                                                                                                         |
| `inline-code`          | Code in a sentence that wraps only after `/`, `_`, `.`, and `-`, so a long path or name breaks at its separators                                                                                                      |
| `kbd`                  | A key, such as `/` or `K`; a shortcut is several                                                                                                                                                                      |
| `table`                | A data table with an optional caption, which scrolls sideways on its own when it's wider than the page                                                                                                                |
| `callout`              | A boxed aside, as a note, a tip, a warning, or a danger, with an optional title; `role="note"` marks one as a note in ARIA's sense                                                                                    |
| `code-block`           | A code window: highlighted code on the dark terminal surface, with window dots, a caption, and copying                                                                                                                |
| `code-diff`            | Two versions of code as a diff: unified on narrow screens, side by side on wide ones                                                                                                                                  |
| `terminal-window`      | The code window's frame around a shell session or output, with a copy button for an element when given its id                                                                                                         |
| `install-command`      | One shell command after a `$` prompt, in a terminal window, with a copy button that copies the command alone                                                                                                          |
| `copy-button`          | A button that copies text, an element, or the text at a `url`, such as a page's Markdown version, with `jg-clipboard`, and says what to do when the browser refuses, for each reason, linking to the `url`'s text     |
| `tabs`                 | ARIA tabs, with arrow keys, Home and End, and an optional remembered choice                                                                                                                                           |
| `dialog`               | A modal dialog, titled by its heading, with a close button: any element with `data-dialog-open` set to its id opens it, Escape, the close button, and a click outside close it, and focus returns to what opened it   |
| `search-dialog`        | A search button and its dialog, which `/` and Ctrl+K or Cmd+K open too, and one Escape closes. Typing searches the site with [Pagefind](https://pagefind.app/), loaded from `pagefindPath`, and lists up to 8 results |
| `package-manager-tabs` | An install command for npm and pnpm in a terminal panel, with the choice remembered across the site                                                                                                                   |

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

| Subpath                                   | What it exports                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `jg-personal-astro-ui/code-window-plugin` | `codeWindowPlugin`, the Sätteri hast plugin that puts Markdown code blocks in code windows                                                                                                                                                                                                                                                 |
| `jg-personal-astro-ui/llms-text`          | `buildLlmsText`, which writes an llms.txt in the llmstxt.org format, `buildLlmsFullText`, which gathers a site's Markdown into one file, and `escapeMarkdownLabel` and `normalizeDescription`, which keep each link one well-formed list item                                                                                              |
| `jg-personal-astro-ui/seo`                | `buildStructuredData`, the JSON-LD of a page (the WebSite with an ItemList of its pages, or a WebPage with its BreadcrumbList and the SoftwareSourceCode it documents), `serializeStructuredData`, which escapes `<` for a script element, and `SEARCH_TEXT_LIMITS`, the lengths that keep titles and descriptions whole in search results |
| `jg-personal-astro-ui/syntax-theme`       | `SYNTAX_THEME`, the Shiki theme that colours code with the `--jg-syntax-*` properties                                                                                                                                                                                                                                                      |
| `jg-personal-astro-ui/theme-preference`   | Reading, writing, and resolving the stored theme preference, and the events the theme script listens to                                                                                                                                                                                                                                    |

## Releasing it

It's checked like every other package, plus an Astro build: `release:verify` installs its tarball with its peers into a temporary Astro site that imports every component, stylesheet, and module, and runs `astro build`. [`releasing.md`](releasing.md) covers the rest.
