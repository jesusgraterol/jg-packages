# Changelog

## 0.1.0

The first release.

### Added

- `buildStructuredData`, which writes a page's JSON-LD: the WebSite and the pages it lists for the home page, and a WebPage with its breadcrumb and the source code it documents for every other page.
- `buildBreadcrumbStructuredData`, a standalone BreadcrumbList whose steps may leave out their URL, and `serializeStructuredData`, which escapes every `<` for a script element.
- `SEARCH_TEXT_LIMITS`, the title and description lengths search results show whole.
- `buildLlmsText` and `buildLlmsFullText`, for llms.txt and llms-full.txt in the llmstxt.org format, with links whose description is optional, plus `escapeMarkdownLabel` and `normalizeDescription`.
- `THEME_PREFERENCES`, `parseThemePreference`, `resolveThemePreference`, `readThemePreference`, and `writeThemePreference`, which read untrusted stored values safely and never throw when the browser blocks storage.
- `API.md`, the full API reference, generated from the TSDoc of the version it ships with.
