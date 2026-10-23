# jg-personal-astro-ui

Jesus Graterol's Astro components, Tailwind token contract, and theme, shared by his personal websites.

> This package exists for Jesus Graterol's own sites. It follows their design, and its API can change in any `0.x` release. You're welcome to read it and use it, but expect breaking changes.

## Install

```bash
npm install jg-personal-astro-ui astro tailwindcss @tailwindcss/vite
```

## Usage

Import Tailwind, the token contract, a theme, and the prose styles in the site's stylesheet:

```css
@import 'tailwindcss';
@import 'jg-personal-astro-ui/styles/contract.css';
@import 'jg-personal-astro-ui/styles/theme.css';
@import 'jg-personal-astro-ui/styles/prose.css';
```

Then build pages from the components, each at its own subpath:

```astro
---
import Button from 'jg-personal-astro-ui/button';
import ThemeInitScript from 'jg-personal-astro-ui/theme-init-script';
---

<head>
  <ThemeInitScript storageKey="my-site-theme" />
</head>
<Button href="/start">Get started</Button>
```

The components style themselves with the contract's tokens only, so another theme can replace `theme.css` by defining every `--jg-*` property and the documented code-window and inverse surface scopes.

Put the code blocks of the site's Markdown in the same code windows as `code-block`, with a copy button each, and open its links to other sites in a new tab, as the components do, through Astro's Markdown processor. Render the Markdown inside `prose`:

```ts
// astro.config.ts
import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import { codeWindowPlugin } from 'jg-personal-astro-ui/code-window-plugin';
import { externalLinkPlugin } from 'jg-personal-astro-ui/external-link-plugin';

const site = 'https://example.com';

export default defineConfig({
  site,
  markdown: {
    processor: satteri({ hastPlugins: [codeWindowPlugin, externalLinkPlugin({ siteUrl: site })] }),
  },
});
```

## Documentation

The token contract, every component, and how to use them in a site are in [docs/personal-astro-ui.md](https://github.com/jesusgraterol/jg-packages/blob/main/docs/personal-astro-ui.md). The reference of its TypeScript modules, such as `./code-window-plugin`, ships in the package as `API.md`. A page's JSON-LD, llms.txt, and the stored theme preference come from [jg-site](https://jg-packages.jesusgraterol.dev/packages/jg-site/), which the components use too.

Tabs expose labeled panels and ordinary panel links without JavaScript. Once enhanced, they support arrow keys, Home, End, Enter, and Space, remembered choices, and synchronized instances. Nested groups keep their own selection; long strips scroll horizontally without moving the page.

`dialog` keeps its title and close action visible while the body scrolls. It restores background styles, page position, and focus on dismissal. Optional `size`, `mobilePresentation="fullscreen"`, `isOverlayCloseEnabled`, and `initialFocus` props configure larger content and phone flows; floating `md` dialogs and backdrop dismissal remain the defaults.

`search-dialog` accepts `title`, `inputLabel`, and `placeholder`, with the existing text as defaults. It announces loading, result counts, empty results, and errors, offers retry after failure, and keeps touch input text at 16px. Pagefind indexes remain shared, results stay bounded to eight, and stale queries cannot replace newer results.

`copy-button` supports `display="icon"`; CodeBlock, TerminalWindow, InstallCommand, PackageManagerTabs, and `renderCodeWindowHeader` accept `copyDisplay="icon"`. The default remains a visible label. Icon mode keeps the label and context accessible, reserves its size through feedback, and provides actionable failure guidance. Controls stay invisible and inert until their shared handler is installed; source content remains readable without JavaScript. The handler also supports dynamically inserted controls and Astro navigation.

For compact Markdown windows, replace `codeWindowPlugin` with `createCodeWindowPlugin({ copyDisplay: 'icon' })` from the same `./code-window-plugin` subpath. The original plugin remains available with its existing defaults. Render the result inside `prose` to enable copying.

CodeBlock accepts `appearance="plain"` to compose within another surface, `overflow="wrap"` for long lines, CSS-length `height` and `maxHeight`, and `ariaLabel` to name its keyboard-focusable source region. The default remains a dark window with horizontal scrolling. Source dimensions leave the header outside the scroll body. Copying preserves the original code, including CRLF and final newlines, independently of highlighting or wrapping.

CodeDiff adds `view="auto" | "unified" | "split"`, `lineNumbers`, `contextLines`, `highlightWords`, `appearance="plain"`, and `overflow="wrap"`. Defaults retain the existing framed, responsive comparison with complete context. Comparisons run at build time, preserve source line endings, and show accurate omission and final-newline notices. Exhausting the bounded edit search produces a full replacement rather than incomplete output.

PageHeader and Prose accept `titleVariant="page" | "document"` and a scoped `titleFont="sans" | "mono"`. Existing page typography remains the default; document typography is more compact. PageHeader also has a `metadata` slot between its lede and actions. The `jg-page-title` and `jg-document-title` CSS utilities expose the title scales directly.

Section supports `tone="inverse"` for a dark surface with its own readable controls, semantic colors, syntax, selection, and focus. IconTile adds `size="compact"` and primary, neutral, accent, success, warning, and danger tones; card size and primary tone remain its defaults.

`accordion` uses native details and summary elements, with optional `isOpen` and exclusive `group`. Its summary, decorative icon, status, and body slots preserve rich portfolio content. Native disclosure works without JavaScript; the shared script opens collapsed ancestors when following a deep link, including after Astro navigation.

`documentation-shell`, `documentation-outline`, and `page-navigation` compose a responsive reading grid, hierarchical anchor links, and adjacent pages. They accept caller-owned navigation and content, retain native disclosures without JavaScript, and add no main landmark or route loading. Their shared types are exported from `jg-personal-astro-ui/contracts`.

`file-preview` composes source or diffs with caller-owned path, status, actions, and footer content. `file-tree` renders supplied file/directory entries as semantic lists and real links. Traversal stops at the documented entry/depth bounds, detects ancestor cycles, and reports a partial preview without counting omitted entries or inferring repository state.

`conversation` and `conversation-message` present ordered transcripts with caller-owned speakers, optional display roles, decorative avatars, content, artifacts, and footers. File previews and file lists compose directly into messages; the components add no provider catalog or transcript parser.

`steps`, `step`, `timeline`, `timeline-item`, and `result-summary` present supplied process and outcome information. Explicit statuses retain text meaning, dates and order remain caller-owned, and summary heading levels fit their surrounding document. Existing controls compose into action slots.

## Private gallery

From a repository checkout, run `pnpm --filter jg-personal-astro-ui gallery:dev` to inspect the components, or `pnpm --filter jg-personal-astro-ui test:e2e` to build the gallery and test it in Chromium, Firefox, and WebKit. The gallery uses public package imports, real Markdown transforms, and a Pagefind index. Its source, preview tooling, and tests are excluded from npm and public website output. See the [gallery workflow](https://github.com/jesusgraterol/jg-packages/blob/main/docs/personal-astro-ui.md#private-gallery).

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-personal-astro-ui/LICENSE)
