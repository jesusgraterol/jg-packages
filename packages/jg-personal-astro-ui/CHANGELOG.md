# Changelog

## 0.1.0

The first release of `jg-personal-astro-ui`.

### Added

- `contract.css`, the token contract that maps the `--jg-*` custom properties into Tailwind's theme, `theme.css`, the light and dark palettes of the jg sites, and `prose.css`, for rendered Markdown.
- The layout, document, navigation, content, and interactive components the jg-packages website builds on, each at its own subpath.
- `./theme-preference`, which reads, stores, and resolves the visitor's theme.
- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.
