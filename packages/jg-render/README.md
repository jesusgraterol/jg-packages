# jg-render

Render prepared HTML to exact-size PNGs with Playwright Chromium on Node.js 22.17 or later. Install the renderer with the version of Playwright you use to launch Chromium.

## Install

```sh
npm install jg-render playwright
npx playwright install chromium
```

## Usage

`withOfflineRenderer` creates and closes one context for a batch. Chromium itself belongs to the caller. The context disables document JavaScript and service workers, denies network access, reduces motion and renders at one pixel per CSS pixel.

Supply an HTML document with inline styles and data URLs for assets. The renderer waits for declared fonts and decodes image elements. Use the optional layout callback for project-specific checks or adjustments after assets load. Return `'overflow'` from that callback to report a layout that does not fit. The callback receives a live page and should use its caller's cancellation signal for any external work.

Use `renderPng` for PNG bytes and `preparePage` to run a trusted callback on a prepared page, for example to call Playwright's PDF API. Each page closes after its callback settles, times out or is cancelled. A render defaults to 15 seconds and accepts dimensions up to 8192 on either side and a total of 33,554,432 pixels.

## Errors

| Code                          | Message                                |
| ----------------------------- | -------------------------------------- |
| `INVALID_HTML_RENDER_OPTIONS` | The HTML render options are invalid.   |
| `HTML_RENDER_FAILED`          | The HTML could not be rendered to PNG. |

The package's errors carry a fixed `data.reason` without document source, resource URLs or asset bytes. Errors from the caller's session or prepared-page callback propagate to the caller.

## Documentation

See [API.md](API.md) for the contracts and [RECIPES.md](RECIPES.md) for examples.

## License

[MIT](LICENSE)
