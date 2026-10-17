# Changelog

## 0.1.0

The first release of `jg-personal-astro-ui`.

### Added

- `contract.css`, the token contract that maps the `--jg-*` custom properties into Tailwind's theme, `theme.css`, the light and dark palettes of the jg sites, and `prose.css`, for rendered Markdown.
- The layout, document, navigation, content, and interactive components the jg-packages website builds on, each at its own subpath.
- Code windows: `code-block` shows highlighted code on the dark terminal surface in both themes, with window dots, a caption, and a copy button, and `./code-window-plugin` puts a site's Markdown code blocks in the same windows.
- Copy buttons copy with `jg-clipboard`, and say what to do when the browser refuses, for each reason it gives.
- External links in `button`, `text-link`, and `site-footer` show an arrow; `button` and the footer's links take `externalIcon: false` to hide it.
- `./theme-preference`, which reads, stores, and resolves the visitor's theme.
- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.
