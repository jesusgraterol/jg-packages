# jg-react

React hooks for the browser: online status, page visibility, Tailwind CSS breakpoints, scroll thresholds, unsaved form changes, resend cooldowns, and light and dark themes, safe in server renders.

## Install

```bash
npm install jg-react
```

It needs React 19.2.4 or later.

## Usage

```ts
import {
  isBreakpointAtLeast,
  useBreakpoint,
  useDocumentVisibility,
  useIsWindowScrolledPast,
  useOnlineStatus,
} from 'jg-react';

export const useLayoutState = () => {
  const isOnline = useOnlineStatus(); // the browser's guess, from its network interfaces
  const isVisible = useDocumentVisibility(); // false while the tab is hidden
  const breakpoint = useBreakpoint(); // 'xs' on a phone, then 'sm' to '2xl'
  const isScrolled = useIsWindowScrolledPast(8);
  return { isOnline, isVisible, isDesktop: isBreakpointAtLeast(breakpoint, 'lg'), isScrolled };
};
```

| Hook                                    | Returns                                                                                                 | Re-renders when                                 | In a server render                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `useOnlineStatus()`                     | Whether the browser is online                                                                           | It goes online or offline                       | `true`                                               |
| `useDocumentVisibility()`               | Whether the page is visible                                                                             | Its tab is hidden or shown                      | `true`                                               |
| `useBreakpoint()`                       | Tailwind CSS's breakpoint: `xs` below `sm`, up to `2xl`                                                 | The viewport crosses a breakpoint               | `undefined`                                          |
| `useIsWindowScrolledPast(pixels)`       | Whether the window is scrolled further than `pixels`                                                    | The answer changes, not every scroll            | `false`                                              |
| `useFormChanges(options)`               | Whether a form's command differs from the last confirmed one, a submit-time check, and `confirmChanges` | The commands or the baseline change             | Compared as usual                                    |
| `useResendCooldown(options)`            | Whether a resend must wait, the seconds left, and `startCooldown`                                       | Every second while cooling down                 | `{ isCoolingDown: false, remainingSeconds: 0 }`      |
| `useCopyFeedback(options?)`             | Whether a copy just succeeded, and `copy(write)`                                                        | A copy succeeds, and its feedback ends          | `isCopied: false`                                    |
| `useFileUploadQueue(options)`           | The upload queue's items, summary, announcement, and controls                                           | The queue changes                               | An empty queue                                       |
| `useResolvedTheme(preference)`          | `light` or `dark`, following the system while the preference is `system`                                | The system's color scheme changes, for `system` | `dark` for `dark`, otherwise `light`                 |
| `useAppliedTheme(preference, options?)` | The theme it sets as the `light` or `dark` class on `<html>`                                            | As `useResolvedTheme`                           | As `useResolvedTheme`, without touching the document |

Keep a save button disabled until the form holds a real change, and a resend button waiting after each send:

```ts
import { useFormChanges, useResendCooldown } from 'jg-react';

const trim = ({ name }: { name: string }) => ({ name: name.trim() });

export const useProfileEditor = (saved: { name: string }, draft: { name: string }) => {
  // a whitespace-only edit isn't a change, and the baseline advances only once a save succeeds
  const { hasChanges, confirmChanges } = useFormChanges({
    confirmedCommand: saved,
    currentCommand: draft,
    normalizeCommand: trim,
  });
  // the deadline survives a reload of the tab, apart from other accounts and actions
  const resend = useResendCooldown({ durationSeconds: 60, cooldownKey: 'account-a:verify-email' });
  return { canSave: hasChanges, confirmChanges, resend };
};
```

The browser hooks read the browser through `useSyncExternalStore`, so every component sees the same value in the same render, and a server render gets a fixed value instead of failing. The breakpoints are Tailwind CSS's defaults, in `rem`, read through media queries, so they follow the browser's font size as CSS does. Prefer CSS for layout, and `useBreakpoint` for what CSS can't do, such as rendering a different component.

### Copy feedback

`useCopyFeedback` shows that a copy worked, for a moment. `copy` takes the function that writes, such as jg-clipboard's `copyText`, and calls it at once, before awaiting anything, so the write stays inside the click that browsers require for clipboard access:

```ts
import { useCopyFeedback } from 'jg-react';

const { isCopied, copy } = useCopyFeedback({ durationSeconds: 1.4, onError: showCopyError });
const onClick = () => void copy(() => navigator.clipboard.writeText(inviteLink)); // resolves to whether it worked
```

`isCopied` stays true for `durationSeconds`, `DEFAULT_COPY_FEEDBACK_SECONDS` (1.4) by default, and a new copy restarts it. A copy while another runs is ignored and resolves to `false`. A failed one resolves to `false` and calls the latest `onError`; `copy` never rejects. After unmount, a copy that settles changes nothing and calls nothing. A duration that isn't positive and finite throws `INVALID_COPY_FEEDBACK_DURATION`.

### File uploads

`useFileUploadQueue` runs a file upload queue without rendering anything, for a drop zone or a file input in the app's own markup:

```ts
import { createFileUploadAcceptValue, useFileUploadQueue } from 'jg-react';

const queue = useFileUploadQueue({
  acceptedFileTypes: ['image/png', 'image/jpeg', '.heic'],
  maxFileBytes: 10 * 1024 * 1024,
  maxFiles: 4,
  isPreviewEnabled: true,
  uploadFile: (file, { signal, reportProgress, uploadId }) =>
    uploadToStorage(file, { signal, onProgress: reportProgress, idempotencyKey: uploadId }),
});
// queue.addFiles(input.files), queue.items, queue.summary, queue.announcement,
// queue.cancelUpload(id), queue.retryUpload(id), queue.removeFile(id), queue.reset()
const accept = createFileUploadAcceptValue(queue.policy.acceptedFileTypes);
```

- **Checks:** each selection is checked file by file, in a fixed order: empty, type, size, duplicate, count, and total size, with `existingFiles` counted toward the limits. A `validateFile` function runs next, such as for an image's dimensions, and the built-in checks run again after it, since the queue may have changed meanwhile. Selections are checked one at a time.
- **Uploads:** admitted files upload first in, first out, up to `maxConcurrentUploads` at once, 2 by default, or wait for `startUploads` without `autoUpload`. Progress is coalesced per frame and never goes backwards. At 100%, a file is `processing`: it waits for its result, can't be canceled, and survives removal and reset.
- **Cancel and retry:** a canceled upload is aborted through its signal, and its late result is ignored, but its slot frees only when its promise settles. A retry keeps the item's `uploadId` and starts the next `attemptNumber`.
- **One file:** with `maxFiles` 1, the default, a new file replaces the current one only once it passes its checks, so a rejected replacement leaves the current file alone.
- **Cleanup:** preview object URLs are revoked on remove, replace, reset, and unmount, and an error a callback throws goes to `reportError` without stopping the queue. Shown again after an `<Activity>` hid it, files whose work stopped are canceled.
- **Text:** every message and announcement comes from `DEFAULT_FILE_UPLOAD_MESSAGES`, which `messages` overrides, and `getErrorFeedback` decides what a failed upload shows, `messages.uploadFailed` by default.

A policy that isn't valid, such as a `maxFileBytes` that isn't a positive integer, throws `INVALID_FILE_UPLOAD_POLICY`, with a message for each field. `resolveFileUploadPolicy`, `validateFileUploadCandidate`, `isFileUploadItemCancelable`, and `hasDraggedFiles` work on their own too.

### Light and dark themes

`createThemeInitScript` builds an inline script that applies the stored preference before the page paints, so a server render never flashes the wrong theme, and `useAppliedTheme` keeps the class on `<html>` in step once React runs:

```tsx
import { createThemeInitScript, useAppliedTheme } from 'jg-react';

// jg-storage's createLocalStore('preferences') keeps { theme } under this key
const script = createThemeInitScript({ storageKey: 'jg-storage:preferences', field: 'theme' });

export const ThemeScript = ({ nonce }: { nonce: string }) => (
  <script
    nonce={nonce}
    dangerouslySetInnerHTML={{ __html: script }}
  />
);

export const ThemeRoot = ({ preference }: { preference: 'light' | 'dark' | 'system' }) => {
  useAppliedTheme(preference); // turns transitions off while the class changes
  return null;
};
```

Set `color-scheme` per class in your stylesheet, such as `:root.dark { color-scheme: dark; }`, so form controls and scrollbars follow the theme.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-react/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-react/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-react/LICENSE)
