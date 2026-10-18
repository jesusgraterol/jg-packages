# Changelog

## 0.3.0

### Added

- An always-dark surface for panels that stay dark in both themes, such as a contact band: `--jg-inverse`, `--jg-inverse-foreground`, and `--jg-inverse-accent`, as the `bg-inverse`, `text-inverse-foreground`, and `text-inverse-accent` utilities.
- `document-head` describes more kinds of page:
  - `openGraphType`, `'website'` by default, or `'article'` or `'profile'`
  - `article`, for the `article:*` tags of an article
  - `profile`, for the `profile:*` tags of a person's profile
- `./new-tab-marker`, the arrow and screen-reader notice that end a link opening a new tab. Its arrow now carries `data-new-tab-marker`.
- `./new-tab-marker-markup` and `./code-window`, which render the marker's and a code window's header markup, for sites whose build checks allow only the markup Markdown produces.
- `llms-text` sections can carry a Markdown `body`, such as an install command in a code block, instead of links.

### Changed

- `document-head`'s `favicon` is now `icons`, a list that takes favicons and home screen icons with their sizes.
- `document-head`'s `markdownUrl` is now `alternate`, which takes the version's media type, such as `text/plain`, and a title.

## 0.2.0

### Added

- `jg-mark`, the lowercase `jg/` mark the jg sites share: Ubuntu Sans Mono's letters drawn as outlines on a dark tile, in fixed colors, so it renders the same on every system and in both themes. `./jg-mark.svg` is the same mark as a file, for a site's social images, and `./jg-favicon.svg` is its slash alone on the same tile, for a favicon, where the three letters are too small to read.

## 0.1.0

The first release of `jg-personal-astro-ui`.

### Added

- `contract.css`, the token contract that maps the `--jg-*` custom properties into Tailwind's theme, `theme.css`, the light and dark palettes of the jg sites, and `prose.css`, for rendered Markdown.
- The layout, document, navigation, content, and interactive components the jg-packages website builds on, each at its own subpath.
- Code windows: `code-block` shows highlighted code on the dark terminal surface in both themes, with window dots, a caption, and a copy button, and `./code-window-plugin` puts a site's Markdown code blocks in the same windows.
- Copy buttons copy with `jg-clipboard`, and say what to do when the browser refuses, for each reason it gives. `copy-button` also copies the text at a `url`, fetched on click, such as a page's Markdown version, and links to it when the copy fails.
- External links in `button`, `text-link`, and `site-footer` show an arrow; `button` and the footer's links take `externalIcon: false` to hide it.
- Smooth navigation without JavaScript: pages crossfade through cross-document view transitions, with the header held still, and `document-head`'s speculation rules prerender a page when the pointer rests on its link.
- `navigation-progress`, a thin bar along the top of the viewport that shows when the next page takes more than 150 ms to arrive.
- `./theme-preference`, which reads, stores, and resolves the visitor's theme.
- `stack`, `page-header`, `card`, `inline-code`, `kbd`, `table`, `callout`, `terminal-window`, and `install-command`.
- `dialog`, a modal dialog that gives focus back to what opened it, and `search-dialog`, which searches the site with Pagefind from a button, `/`, or Ctrl+K, and which `site-header` shows at every width.
- `./seo`, which builds a page's JSON-LD and serializes it safely for a script element, with the length limits of search results, and `./llms-text`, which writes llms.txt and llms-full.txt.
- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.
