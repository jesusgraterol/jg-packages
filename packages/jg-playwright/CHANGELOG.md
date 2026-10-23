# Changelog

## 0.2.0

### Added

- `expectNoAxeViolations`'s `ruleSet` option, `IAxeRuleSet`: `'wcag21aa'`, the default and the rules it ran before, WCAG 2.0 and 2.1 levels A and AA; `'wcag22aa'`, those and WCAG 2.2 level AA; or `'axe-default'`, every rule axe runs by default, best practices included.
- `ERRORS.INVALID_AXE_OPTIONS`, which `expectNoAxeViolations` throws for any other `ruleSet`, before it scans anything.

## 0.1.0

The first release.

### Added

- `expectNoHorizontalOverflow`, which retries until the document fits the viewport's `clientWidth`, and names up to 8 elements past its right edge when it doesn't.
- `waitForPageAssets`, which waits for web fonts, every image, and two animation frames, and names an image that loads nothing it can draw.
- `inspectMotion`, which lists the running animations that move or resize an element, with whether the page sees reduced motion.
- `fillProtectedField`, which fills a secret and throws `PROTECTED_FIELD_FILL_FAILED` with only the first line of Playwright's message, the value redacted, and no cause.
- `installFakeMicrophone` and `waitForRecordedAudio`, a tone in place of the microphone that the page's own MediaRecorder records, which can refuse the first request.
- `jg-playwright/axe`: `expectNoAxeViolations`, a scan for WCAG 2.0 and 2.1 level A and AA violations, with `@axe-core/playwright` as an optional peer it loads only when called.
- `API.md`, the full API reference, generated from the TSDoc of the version it ships with.
