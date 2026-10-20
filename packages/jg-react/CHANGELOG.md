# Changelog

## 0.6.0

### Added

- `useDebouncedSearch({ query, enabled?, search })`, which searches the trimmed query once it stays unchanged for 0.3 seconds, aborts the search in flight when the query changes, the search is disabled, or the component unmounts, ignores a result that settles late, and returns `{ results, isSearching, error, retry }`.
- `useActiveHeading({ headingIds, topOffsetPx })`, which follows the heading the URL's hash names and, with an `IntersectionObserver`, the last heading past the offset, returning `{ activeHeadingId, setActiveHeadingId }`. An invalid offset throws `INVALID_ACTIVE_HEADING_OFFSET`.
- `IUseDebouncedSearchOptions`, `IUseDebouncedSearchResult`, `IUseActiveHeadingOptions`, and `IUseActiveHeadingResult`.

### Changed

- Depends on `jg-site`, whose `IThemePreference`, `IResolvedTheme`, `THEME_PREFERENCES`, and `resolveThemePreference` the theme hooks use. jg-react no longer exports its own, so import them from jg-site; `THEME_PREFERENCES` is now `['system', 'light', 'dark']`.

## 0.5.0

### Changed

- Supports Node.js 22.17.0 and later, down from 24.

## 0.4.0

### Added

- `createDialogSession({ whileOpen?, restoreFocus? })`, one dialog's sessions outside React: `open(options, { returnFocusTo? })` resolves to the result `close(result?, id?)` gives, or to `undefined` when another session replaces it, and never rejects; a `close` naming an ended session's id does nothing; and one frame after a close, focus returns to the element the session opened from, when it can still take focus and focus is lost. `getSnapshot` and `subscribe` read it from anywhere, such as jg-react-router's `useDialogNavigationDismissal`.
- `useDialogSession(session)`, which reads the open session, the same object while it lasts, and `null` on a server.
- `useDocumentTheme()`, which reads the theme the page shows from `<html>`'s class, `dark` winning, then `light`, then the system's color scheme, re-rendering only when it changes, and `light` on a server.
- `useElementWidth(select)`, which turns an element's border-box width into the value `select` gives, through a callback `ref`, measuring before the first paint, then with a `ResizeObserver` or the window's `resize` event, re-rendering only when the value changes, keeping it while the element measures 0, and resetting it when the element detaches.
- `IDialogSession`, `IDialogSessionOptions`, `IDialogSessionOpenInit`, `IDialogSessionSnapshot`, and `IUseElementWidthResult`.

### Removed

- The recipe for polling only while the tab is visible, which jg-tanstack-query's `createPollingQueryOptions` now covers, pausing in a hidden tab and stopping after a failed fetch.

## 0.3.0

### Added

- `useCopyFeedback({ durationSeconds?, onError? })`, which shows that a copy worked for a moment. Its `copy(write)` calls `write` before awaiting anything, so a clipboard write stays inside the click, ignores a copy while another runs, resolves to whether it worked without ever rejecting, and passes a failure to the latest `onError`. Nothing changes after unmount. A duration that isn't positive and finite throws `INVALID_COPY_FEEDBACK_DURATION`.
- `DEFAULT_COPY_FEEDBACK_SECONDS`, `IUseCopyFeedbackOptions`, and `IUseCopyFeedbackResult`.
- `useFileUploadQueue(options)`, a headless file upload queue: each selection is checked in a fixed order against the policy and `existingFiles`, then by `validateFile`, then again; admitted files upload first in, first out, within `maxConcurrentUploads`, with progress coalesced per frame; uploads can be canceled until every byte is sent, retried under the same id, removed, and reset; a single file is replaced only once its successor validates; preview URLs are revoked when no longer shown; and an announcement follows each change. A policy that isn't valid throws `INVALID_FILE_UPLOAD_POLICY`.
- `resolveFileUploadPolicy`, `validateFileUploadCandidate`, `createFileUploadAcceptValue`, `hasDraggedFiles`, `isFileUploadItemCancelable`, `DEFAULT_FILE_UPLOAD_MESSAGES`, and the upload queue's types.
- Recipes for a copy button that explains a failed copy by jg-clipboard's error code, and for an accessible upload field.

## 0.2.0

### Added

- `useFormChanges({ confirmedCommand, currentCommand, normalizeCommand? })`, which tells whether a form's command differs by value from the last confirmed one, with a submit-time check and `confirmChanges` to advance the baseline once a save succeeds.
- `useResendCooldown({ durationSeconds, cooldownKey?, lastAttemptedAt?, storeId? })`, which makes a resend wait after each send, with a countdown. With a key, the deadline survives a reload of the tab in sessionStorage, and stays in memory when storage fails. The first render is always `{ isCoolingDown: false, remainingSeconds: 0 }`, so hydration never mismatches. A duration that isn't a positive safe integer throws `INVALID_COOLDOWN_DURATION`.
- `useResolvedTheme(preference)`, which resolves a light, dark, or system preference to the theme a page shows, following the system's color scheme while the preference is `system`, and `resolveThemePreference(preference, systemPrefersDark)`, the same resolution outside React.
- `useAppliedTheme(preference, options?)`, which sets the `light` or `dark` class on `<html>` before the browser paints, with transitions off while it changes unless `disableTransitionsOnChange` is false.
- `createThemeInitScript({ storageKey, field?, defaultPreference? })`, which builds the inline script that applies the stored preference before the page paints. Its output is deterministic and escaped for a `<script>` element, and options that aren't valid throw `INVALID_THEME_SCRIPT_OPTIONS`.
- `THEME_PREFERENCES`, and the types `IThemePreference`, `IResolvedTheme`, `IAppliedThemeOptions`, and `IThemeInitScriptOptions`.
- A recipe for a theme that applies before the first paint.
- `ERRORS`, and the types `IFormChangesComparable`, `IUseFormChangesOptions`, `IUseFormChangesResult`, `IUseResendCooldownOptions`, and `IUseResendCooldownResult`.
- Dependencies on jg-exception, jg-storage, and jg-utilities.

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `useOnlineStatus`, `useDocumentVisibility`, `useBreakpoint`, and `useIsWindowScrolledPast`, each built on `useSyncExternalStore`, with a fixed value in a server render.
- `useBreakpoint` reads Tailwind CSS's default breakpoints, and returns `xs` below `sm`, such as on a phone. `isBreakpointAtLeast` compares two breakpoints.
- `useIsWindowScrolledPast` re-renders only when its answer changes, not on every scroll.
