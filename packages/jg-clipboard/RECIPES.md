# jg-clipboard recipes

Patterns for copy and paste buttons that work across browsers, and say what to do when the browser refuses.

## A copy button that explains a refusal

Use this for a button that copies a code snippet, a share link, or a key. Browsers refuse a copy for several reasons, and jg-clipboard names each one with a code, so the message can tell the person what to do next, and how to get the text another way:

```ts
import { copyText, ERRORS } from 'jg-clipboard';
import { hasErrorCode } from 'jg-exception';

// the element whose text the button copies
declare const snippet: HTMLElement;

// a status line, such as an element with role="status", so screen readers announce the outcome
declare const copyStatus: HTMLElement;

// says what to do after a copy failed, so the text can still be copied by hand
const describeCopyFailure = (error: unknown): string => {
  if (hasErrorCode(error, ERRORS.CLIPBOARD_PERMISSION_DENIED)) {
    return 'Your browser blocked copying. Select the text and copy it manually.';
  }
  if (hasErrorCode(error, ERRORS.CLIPBOARD_NO_USER_GESTURE)) {
    return 'Your browser only copies right after a click. Click Copy again.';
  }
  if (hasErrorCode(error, ERRORS.CLIPBOARD_NOT_FOCUSED)) {
    return 'Copying needs this tab to be in focus. Click the page, then click Copy again.';
  }
  if (hasErrorCode(error, ERRORS.CLIPBOARD_UNSUPPORTED)) {
    return "This browser can't copy from this page. Select the text and copy it manually.";
  }
  return 'Copying failed. Select the text and copy it manually.';
};

button.addEventListener('click', async () => {
  // cleared first, so an earlier outcome never shows during this attempt
  copyStatus.textContent = '';
  try {
    // nothing awaits before copyText, so the browser still sees the click
    await copyText(snippet.textContent ?? '');
    copyStatus.textContent = 'Copied';
  } catch (error) {
    copyStatus.textContent = describeCopyFailure(error);
  }
});
```

`CLIPBOARD_WRITE_FAILED`, and anything unexpected, gets the general message. A `CLIPBOARD_PERMISSION_DENIED` error's `data.permission` holds the Permissions API's state, or `null` where the browser can't say; `'denied'` means the site's settings block the clipboard, which no second click fixes. To hide a button that can never work, check `getClipboardSupport().copyText` first, and keep the messages, because a supported copy can still be refused.

## A paste button for text or an image

Use this for a paste button in a composer that takes a screenshot or text. `readClipboard` reads every kind of content with one call, so the person sees one paste prompt at most, and returns an image as PNG, whatever type it was copied as. A browser that reads only text gets `readText` instead:

```ts
import { ERRORS, getClipboardSupport, readClipboard, readText } from 'jg-clipboard';
import { hasErrorCode } from 'jg-exception';

// a status line that says why a paste failed
declare const pasteStatus: HTMLElement;

const support = getClipboardSupport();

// a browser that can't read the clipboard gets no button, and the keyboard still pastes there
pasteButton.hidden = !support.read && !support.readText;

// shows a pasted image, and releases the previous one, so repeated pastes don't keep it in memory
const showImage = (image: Blob): void => {
  if (preview.src.startsWith('blob:')) {
    URL.revokeObjectURL(preview.src);
  }
  preview.src = URL.createObjectURL(image);
};

const describePasteFailure = (error: unknown): string => {
  if (hasErrorCode(error, ERRORS.CLIPBOARD_PERMISSION_DENIED)) {
    return 'Your browser blocked pasting. Paste with Ctrl+V, or Cmd+V on a Mac, instead.';
  }
  if (hasErrorCode(error, ERRORS.CLIPBOARD_INVALID_IMAGE)) {
    return "The copied image can't be read. Save it, then attach the file instead.";
  }
  return 'Pasting failed. Paste with Ctrl+V, or Cmd+V on a Mac, instead.';
};

pasteButton.addEventListener('click', async () => {
  pasteStatus.textContent = '';
  try {
    // nothing awaits before the read, which Safari needs
    if (!support.read) {
      input.value = await readText();
      return;
    }
    const { text, image } = await readClipboard();
    if (image !== null) {
      showImage(image);
    } else if (text !== null) {
      input.value = text;
    } else {
      pasteStatus.textContent = 'The clipboard holds no text or image to paste.';
    }
  } catch (error) {
    pasteStatus.textContent = describePasteFailure(error);
  }
});
```

Safari and Firefox show a paste prompt on every read, and Chromium asks for the clipboard-read permission once, so read only when the person clicks. Which content wins when the clipboard holds both depends on the app: copied spreadsheet cells can come with a picture of the cells, so a field for tables would check `text` first. `CLIPBOARD_INVALID_IMAGE` means the clipboard held only an image the browser can't decode. When text or HTML came with it, `readClipboard` returns them with `image: null` instead, so the paste falls through to the text.
