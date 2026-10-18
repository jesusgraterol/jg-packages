# Changelog

## 0.1.0

The first release of `jg-personal-astro-ui`.

### Added

- `contract.css`, the token contract that maps the `--jg-*` custom properties into Tailwind's theme, `theme.css`, the light and dark palettes of the jg sites, and `prose.css`, for rendered Markdown.
- The layout, document, navigation, content, and interactive components the jg-packages website builds on, each at its own subpath.
- Code windows: `code-block` shows highlighted code on the dark terminal surface in both themes, with window dots, a caption, and a copy button, and `./code-window-plugin` puts a site's Markdown code blocks in the same windows.
- Copy buttons copy with `jg-clipboard`, and say what to do when the browser refuses, for each reason it gives.
- External links in `button`, `text-link`, and `site-footer` show an arrow; `button` and the footer's links take `externalIcon: false` to hide it.
- Smooth navigation without JavaScript: pages crossfade through cross-document view transitions, with the header held still, and `document-head`'s speculation rules prerender a page when the pointer rests on its link.
- `navigation-progress`, a thin bar along the top of the viewport that shows when the next page takes more than 150 ms to arrive.
- `./theme-preference`, which reads, stores, and resolves the visitor's theme.
- `stack`, `page-header`, `card`, `inline-code`, `kbd`, `table`, `callout`, `terminal-window`, and `install-command`.
- `./seo`, which builds a page's JSON-LD and serializes it safely for a script element, with the length limits of search results, and `./llms-text`, which writes llms.txt and llms-full.txt.
- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.
