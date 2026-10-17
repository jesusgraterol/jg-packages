# Changelog

## 0.1.0

The first release.

### Added

- `copyText`, `copyHtml`, and `copyImage`, which call the clipboard before their first await and accept promised content, for Safari. Images that aren't PNG are redrawn as PNG.
- `readText` and `readClipboard`, which reads text, HTML, and a PNG image with one call.
- `getClipboardSupport`, which never throws and is safe during server rendering.
- `ERRORS`: `CLIPBOARD_UNSUPPORTED`, `CLIPBOARD_PERMISSION_DENIED`, `CLIPBOARD_NO_USER_GESTURE`, `CLIPBOARD_NOT_FOCUSED`, `CLIPBOARD_INVALID_IMAGE`, `CLIPBOARD_WRITE_FAILED`, and `CLIPBOARD_READ_FAILED`, each with the browser's error as its cause.
