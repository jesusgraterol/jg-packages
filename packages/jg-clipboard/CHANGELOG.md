# Changelog

## 0.2.0

### Changed

- `readClipboard` returns the text and HTML when the clipboard's image can't be read, with `image: null`, instead of failing as a whole. It still throws `CLIPBOARD_INVALID_IMAGE`, or `CLIPBOARD_READ_FAILED`, when the image is all the clipboard holds.

## 0.1.1

### Added

- `RECIPES.md`, patterns for apps that use the package: a copy button that explains a refusal, and a paste button for text or an image. Each block is typechecked against the release.

## 0.1.0

The first release.

### Added

- `copyText`, `copyHtml`, and `copyImage`, which call the clipboard before their first await and accept promised content, for Safari. Images that aren't PNG are redrawn as PNG.
- `readText` and `readClipboard`, which reads text, HTML, and a PNG image with one call.
- `getClipboardSupport`, which never throws and is safe during server rendering.
- `ERRORS`: `CLIPBOARD_UNSUPPORTED`, `CLIPBOARD_PERMISSION_DENIED`, `CLIPBOARD_NO_USER_GESTURE`, `CLIPBOARD_NOT_FOCUSED`, `CLIPBOARD_INVALID_IMAGE`, `CLIPBOARD_WRITE_FAILED`, and `CLIPBOARD_READ_FAILED`, each with the browser's error as its cause.
- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.
