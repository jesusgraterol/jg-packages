# jg-clipboard

Copy and read text, HTML, and images on the browser clipboard, with support detection and coded errors that say why the browser refused.

## Install

```bash
npm install jg-clipboard
```

## Usage

Copy from a click or key press handler. Each copy calls the clipboard before its first `await`, so the browser still sees the gesture:

```ts
import { copyText, ERRORS } from 'jg-clipboard';
import { hasErrorCode } from 'jg-exception';

copyButton.addEventListener('click', async () => {
  try {
    await copyText('npm install jg-clipboard');
    showToast('Copied');
  } catch (error) {
    if (hasErrorCode(error, ERRORS.CLIPBOARD_PERMISSION_DENIED)) {
      showToast('Allow clipboard access to copy');
    }
  }
});
```

Content that loads after the click can be a promise. It goes through a `ClipboardItem` that waits for it, which Safari needs:

```ts
shareButton.addEventListener('click', () => {
  void copyText(fetch('/share-link').then((response) => response.text()));
});
```

Copy HTML with its plain text, and images. A PNG is copied as it is, and other types the browser can decode, such as JPEG or WebP, are redrawn as PNG, the only image type browsers accept on the clipboard:

```ts
import { copyHtml, copyImage } from 'jg-clipboard';

await copyHtml('<strong>Order #42</strong> shipped', { text: 'Order #42 shipped' });
await copyImage(fetch('/chart.jpg').then((response) => response.blob()));
```

Read from a paste button. `readClipboard` reads the text, HTML, and image with one call, so the person pasting sees one prompt at most. An image the browser can't read comes back as `null` when text or HTML was copied with it, so the text still pastes:

```ts
import { readClipboard, readText } from 'jg-clipboard';

pasteButton.addEventListener('click', async () => {
  const { text, html, image } = await readClipboard(); // each null when the clipboard lacks it
  input.value = text ?? (await readText());
});
```

Show only what the browser supports. `getClipboardSupport` never throws, and reports everything as `false` during server rendering:

```ts
import { getClipboardSupport } from 'jg-clipboard';

const support = getClipboardSupport(); // { isSecureContext, copyText, copyHtml, copyImage, readText, read }
copyImageButton.hidden = !support.copyImage;
```

### Errors

Every failure is an `Exception` with one of these codes, and the browser's error as its `cause`:

| Code                          | When                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLIPBOARD_UNSUPPORTED`       | The page isn't a secure context, such as HTTPS or localhost, or the browser lacks the API                                                          |
| `CLIPBOARD_NOT_FOCUSED`       | The browser refused because the page doesn't have focus                                                                                            |
| `CLIPBOARD_NO_USER_GESTURE`   | The browser refused because the call didn't follow a click or a key press                                                                          |
| `CLIPBOARD_PERMISSION_DENIED` | The browser refused for any other reason, such as a denied or dismissed permission; `data.permission` holds the Permissions API's state, or `null` |
| `CLIPBOARD_INVALID_IMAGE`     | The image can't be decoded as PNG: an image to copy, or one `readClipboard` read without text or HTML beside it                                    |
| `CLIPBOARD_WRITE_FAILED`      | A copy failed otherwise, such as content whose promise rejected                                                                                    |
| `CLIPBOARD_READ_FAILED`       | A read failed otherwise                                                                                                                            |

### Browser limits

- The clipboard needs a secure context: HTTPS, or `localhost` while developing.
- Copy and read from a click or key press handler. Safari refuses calls that don't follow one directly, and Chromium needs the page to have focus.
- Reading asks first. Safari and Firefox show a paste prompt each time, and Chromium asks once for the clipboard-read permission.
- Images go on the clipboard as PNG only. Converting another type needs `createImageBitmap`, so it works in every current browser, but not in very old ones.
- Without `ClipboardItem`, a promised text loads before the copy starts, and Safari may then refuse it.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-clipboard/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-clipboard/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-clipboard/LICENSE)
