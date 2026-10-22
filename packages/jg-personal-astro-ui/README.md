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

The components style themselves with the contract's tokens only, so another theme can replace `theme.css` by defining every `--jg-*` property.

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

## Private gallery

From a repository checkout, run `pnpm --filter jg-personal-astro-ui gallery:dev` to inspect the components, or `pnpm --filter jg-personal-astro-ui test:e2e` to build the gallery and test it in Chromium, Firefox, and WebKit. The gallery uses public package imports, real Markdown transforms, and a Pagefind index. Its source, preview tooling, and tests are excluded from npm and public website output. See the [gallery workflow](https://github.com/jesusgraterol/jg-packages/blob/main/docs/personal-astro-ui.md#private-gallery).

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-personal-astro-ui/LICENSE)
