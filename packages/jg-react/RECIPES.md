# jg-react recipes

Patterns for components that follow the browser: the network, the viewport, the theme, copying to the clipboard, and uploading files.

## An offline banner

Tell people why a request failed, instead of letting the page look broken:

```tsx
import { useOnlineStatus } from 'jg-react';

export const OfflineBanner = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) {
    return null;
  }
  return (
    <div
      role="status"
      className="bg-warning px-4 py-2 text-sm"
    >
      You're offline. Your changes will sync when you reconnect.
    </div>
  );
};
```

The browser's guess can be wrong both ways: a connected laptop can lack internet access, and a flaky network can report online. Use it to explain a failure, never to skip a request.

## A navigation that changes with the viewport

Render a different component on a phone, where CSS alone can't swap them, and shadow the header once the page scrolls:

```tsx
import type { JSX } from 'react';
import { isBreakpointAtLeast, useBreakpoint, useIsWindowScrolledPast } from 'jg-react';

declare const SideNavigation: () => JSX.Element;
declare const BottomTabs: () => JSX.Element;

export const AppHeader = () => {
  const breakpoint = useBreakpoint();
  const isScrolled = useIsWindowScrolledPast(8);

  return (
    <header className={isScrolled ? 'sticky top-0 shadow-md' : 'sticky top-0'}>
      {isBreakpointAtLeast(breakpoint, 'md') ? <SideNavigation /> : <BottomTabs />}
    </header>
  );
};
```

`useBreakpoint` is `undefined` in a server render, so `isBreakpointAtLeast` is false there, and the page renders the phone layout first, then the wider one once it hydrates.

## A theme that applies before the first paint

Use this in a server-rendered React app that offers light, dark, and system themes. React applies the theme only once it runs, so without a script in `<head>` the page shows the default theme first, then flashes to the user's. `createThemeInitScript` builds that script from where the preference is stored, and `useAppliedTheme` takes over once React runs:

```tsx
import { createThemeInitScript, useAppliedTheme } from 'jg-react';
import type { IThemePreference } from 'jg-site';

// the localStorage key the app keeps the user's preferences under, as jg-storage's
// createLocalStore('preferences') writes it, with the theme in its `theme` field
const PREFERENCES_KEY = 'jg-storage:preferences';

// built once: the same options always give the same script, so a hash-based CSP works too
const THEME_SCRIPT = createThemeInitScript({ storageKey: PREFERENCES_KEY, field: 'theme' });

// rendered at the top of the server's <head>, with the request's CSP nonce
export const ThemeScript = ({ nonce }: { nonce: string }) => (
  <script
    nonce={nonce}
    dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
  />
);

// reads the user's preference, such as from the app's settings store
declare function usePreferredTheme(): IThemePreference;

// keeps <html>'s class in step with the preference, and with the system while it's `system`
export const ThemeController = () => {
  useAppliedTheme(usePreferredTheme());
  return null;
};
```

The script falls back to the system theme when nothing is stored, the value isn't a preference, or storage can't be read, and never throws. Give your stylesheet a `color-scheme` per class, such as `:root.light { color-scheme: light; }` and `:root.dark { color-scheme: dark; }`, so form controls and scrollbars follow the theme. When the preference changes, `useAppliedTheme` swaps the class before the browser paints, with transitions off for two frames, so colors switch at once instead of animating.

## A copy button that explains failures

Pair `useCopyFeedback` with jg-clipboard's `copyText`, and tell the user what to do when the browser refuses, by its error code:

```tsx
import { copyText, ERRORS } from 'jg-clipboard';
import { getErrorCode } from 'jg-exception';
import { useCopyFeedback } from 'jg-react';

// the app's notification function
declare const showNotice: (message: string) => void;

// what to tell the user about a failed copy, by jg-clipboard's code
const describeCopyError = (error: unknown): string => {
  switch (getErrorCode(error)) {
    case ERRORS.CLIPBOARD_UNSUPPORTED:
      return "This browser can't copy for you. Select the text and copy it.";
    case ERRORS.CLIPBOARD_PERMISSION_DENIED:
      return 'Allow clipboard access for this site, then try again.';
    default:
      return "The text couldn't be copied. Try again.";
  }
};

export const CopyLinkButton = ({ url }: { url: string }) => {
  const { isCopied, copy } = useCopyFeedback({
    onError: (error) => showNotice(describeCopyError(error)),
  });
  return (
    <button
      type="button"
      onClick={() => void copy(() => copyText(url))}
    >
      {isCopied ? 'Copied' : 'Copy link'}
    </button>
  );
};
```

`copyText` runs inside the click because `copy` calls it before awaiting anything; awaiting something first, such as loading the text, can lose the click and fail with `CLIPBOARD_NO_USER_GESTURE`. A label that changes to "Copied" also reaches screen readers when the button has focus.

## An accessible upload field

`useFileUploadQueue` leaves the markup to the app. A native file input keeps the field usable from the keyboard and by screen readers, the drop zone adds dragging on top of it, and a polite live region reads the queue's announcements:

```tsx
import type { DragEvent } from 'react';
import {
  createFileUploadAcceptValue,
  hasDraggedFiles,
  isFileUploadItemCancelable,
  useFileUploadQueue,
} from 'jg-react';

// sends a file to the app's storage, reporting its progress
declare const uploadAttachment: (
  file: File,
  options: { signal: AbortSignal; onProgress: (sent: number, total: number) => void },
) => Promise<{ url: string }>;

export const AttachmentField = () => {
  const queue = useFileUploadQueue({
    acceptedFileTypes: ['application/pdf', 'image/*'],
    maxFileBytes: 20 * 1024 * 1024,
    maxFiles: 5,
    uploadFile: (file, { signal, reportProgress }) =>
      uploadAttachment(file, { signal, onProgress: reportProgress }),
  });
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (hasDraggedFiles(event.dataTransfer.types)) {
      event.preventDefault();
      queue.addFiles(event.dataTransfer.files);
    }
  };
  return (
    <div
      onDragOver={(event) => {
        if (hasDraggedFiles(event.dataTransfer.types)) event.preventDefault();
      }}
      onDrop={onDrop}
    >
      <label htmlFor="attachments">Attachments, PDF or images, up to 20 MB each</label>
      <input
        id="attachments"
        type="file"
        multiple
        accept={createFileUploadAcceptValue(queue.policy.acceptedFileTypes)}
        onChange={(event) => {
          queue.addFiles(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
        }}
      />
      <ul>
        {queue.items.map((item) => (
          <li key={item.uploadId}>
            {item.file.name}: {item.status}
            {item.status === 'uploading' ? ` (${String(item.progress.percentage)}%)` : null}
            {item.status === 'rejected' ? ` ${item.validationIssue.message}` : null}
            {isFileUploadItemCancelable(item) ? (
              <button
                type="button"
                onClick={() => queue.cancelUpload(item.uploadId)}
              >
                Cancel {item.file.name}
              </button>
            ) : null}
            {item.status === 'failed' || item.status === 'canceled' ? (
              <button
                type="button"
                onClick={() => queue.retryUpload(item.uploadId)}
              >
                Retry {item.file.name}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <p aria-live="polite">{queue.announcement}</p>
    </div>
  );
};
```

Clearing the input's value after each selection lets the user pick the same file again, such as after removing it. A `progress` element per item, and a button for `reset`, are natural next steps; keep the status in text too, not only in color.
