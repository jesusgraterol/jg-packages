# jg-react-ui

Consumer-themed React components with retained Moldea-derived APIs.

## Install

```bash
pnpm add jg-react-ui
```

## Usage

```ts
import { createElement } from 'react';
import { Button } from 'jg-react-ui/components/button';
const saveAction = createElement(Button, { size: 'touch' }, 'Save changes');
```

Import Tailwind once, then `jg-react-ui/styles.css`. Supply `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--destructive`, `--chart-1` (success), `--chart-2` (warning), `--border`, `--radius`, `--jg-ui-font-sans`, `--jg-ui-font-mono`, `--jg-ui-shadow-inset`, `--jg-ui-shadow-surface`, `--code`, `--code-foreground`, `--jg-ui-shadow-raised`, and `--jg-ui-inverse-color-scheme` in your own theme. Colors must be complete CSS color values. `.dark` selects dark utility variants; this package supplies no brand palette. For the JG palette and fonts, use `jg-personal-react-ui` instead.

Button, Badge, IconTile, and Alert retain Moldea’s APIs from commit `2920a7b0a6e814e95872fcdd6dd8746ae422c038`, including variants, sizes, refs, badges, and `asChild` where supported. The exported `badgeVariants`, `iconTileVariants`, and `alertVariants` retain their source signatures. Badge defaults to a span; IconTile is decorative unless `aria-hidden={false}` is supplied; static Alert uses `role="alert"`, with phrasing-content title and description slots. Button’s touch sizes preserve at least 44px under a coarse pointer, including on tablets. Button’s `asChild` requires exactly one element and retains Base UI’s button semantics, including when that element is an anchor. Use the child’s explicit `role="link"` when it represents navigation.

All JavaScript entries are safe to import during server rendering. Styles remain explicit CSS imports. UI preference schemas retain the complete theme, diff layout, wrapping, and install-dismissal record; the dismissal timestamp is an ISO datetime string or `null`. Providers create their stores per mounted tree and perform no browser storage I/O during rendering.

Preferences, themes, and notifications derive from the same pinned Moldea commit. Package adaptations replace the global store and private application registry with provider-local SSR-safe stores and scoped error feedback, validate captured namespaces against jg-storage’s rules, preserve cancellation, and allow explicit `null` dismissal resets. Theme effects use React’s browser lifecycle, and the notification host preserves the configured font and hydrates into a body portal.

Badge and Alert `asChild` also require exactly one element, otherwise they throw `Error("asChild requires exactly one valid React element child.")`. For `interaction="redirect"`, slot an anchor; for `interaction="action"`, slot a native button. The interaction option supplies styling, while the native child supplies keyboard semantics. Keep supplementary `AlertAction` controls inside a static Alert, away from interactive parent buttons or anchors. A linked Badge remains compact by default; add coarse-pointer minimum dimensions when it is a standalone touch target.

ErrorFeedbackProvider scopes application-owned error copy and access-loss classification to a React tree. Pass a resolver from `createErrorFeedback` in `jg-exception`; `useErrorFeedbackResolver` reads the nearest policy. Without a provider, unknown diagnostics and codes remain private behind generic copy. Cancellation stays recognizable, and a throwing application policy falls back safely.

## Preferences, theme, and notifications

Compose `UiPreferencesProvider`, `ThemeProvider`, and one `Toastr` host in that order. `ThemeToggleButton` retains the source Button props and request callback. The document theme and Sonner notification channel are document-wide; keep one theme owner and one notification host per document even when independent preference roots are mounted.

Sonner injects its base notification CSS when its browser module loads. Package theme styles remain explicit imports. All JavaScript entries remain importable without browser globals on the server.

The preference provider supports explicit `local`, `read-only`, and `remote` modes. Local mode reads and writes best-effort browser storage and follows matching cross-tab events. Read-only mode exposes a snapshot and denies updates. Remote mode requires complete `initialPreferences` and an async `persistPreferences` adapter: updates are optimistic, saves run sequentially and coalesce newer snapshots, and a rejected save rolls back to the latest authoritative props. The application owns network requests and cache invalidation. Pending requests cannot update storage or show notifications after unmount.

Optional `storageId` defaults to `jg-ui-preferences`. It must be non-empty and contain only ASCII letters, digits, underscores, and hyphens. `getUiPreferencesStorageKey` returns its raw `jg-storage:` key. IDs are captured for the provider lifetime; use a keyed remount to change namespaces. Invalid IDs fail before storage access or initialization-script creation.

Render `ThemeInitializationScript` in the document head before application JavaScript, using the same `storageId` as the provider and your CSP `nonce` when required. Server snapshots use initial props or defaults, then storage synchronizes after hydration. See the recipes for composition and the shared [owned error contracts](https://unpkg.com/jg-react-ui@0.3.0/errors/README.md).

## Controls, forms, and plain text

Forms, select/choice controls, tabs, dropdown menus, tooltips, copy feedback, progress, dividers, empty states, links, inline code, and plain typography/table primitives retain the same pinned Moldea APIs. The application owns form validation and associations. Set your app root's `font-sans bg-background text-foreground` classes, supply both shadow roles and code color roles, and compose labelled touch rows around compact checkbox/radio/switch glyphs. Fields use at least 16px text under a coarse pointer; touch tabs and menu rows retain 44px targets. `tw-animate-css` supplies the retained enter/exit animation utilities through the explicit package stylesheet.

`TabsList` requires `overflowBehavior: 'scroll' | 'truncate'`; composite labels in a truncated list need `title` or `aria-label`. Select and menu dismiss aliases honor intentional cancellation. Select keeps the source's accepted `forceMount`/`sticky` aliases without additional Base UI behavior. Slotted controls require one valid element and retain their component-specific native Error guards. Menus and tooltips retain their portal and positioning APIs. Rich code typography and editor components are added separately.

`CopyButton` writes exact text during the initiating gesture, blocks overlapping writes, and starts feedback after fulfillment. Its feedback duration remains milliseconds. `copyLabel` supplies a scoped ready name, visible `label`/`copiedLabel` and native naming overrides are retained, failures use the nearest error policy, and cancellation stays silent. It clears timers and ignores late feedback after unmount. TextLink adds secure rel tokens and a new-tab announcement; TableContainer accepts native region/name/focus props for keyboard-scrollable tables.

## Dialogs, drawers, and layout

Dialog, AlertDialog, Drawer, ConfirmationDialog, and page/layout primitives retain the pinned compound APIs. DialogContent requires a size and direct DialogHeader, DialogBody, and optional DialogFooter children; asChild accepts one panel element containing those regions. Use an element that permits the dialog role, such as a div; place a form inside the body and associate fixed submit actions with its form ID. Drawer requires a side, its content requires a size, and its direct regions are ordered header, body, optional footer. AlertDialogContent requires a direct header and footer. Invalid composition and invalid slotted children retain native Error guards.

Medium and large dialogs become full-screen pages on phones, with generated Back and desktop close controls. Body regions own scrolling, while headers and actions stay fixed. Compact modal close controls retain their fine-pointer appearance and have actual 44px targets under a coarse pointer. The default initial focus skips unusable controls; initialFocus and generated control icons/labels remain configurable. Overlay dismissal stays disabled by default for dialogs. isDismissalDisabled blocks on-page dismissal; committed navigation still cancels obsolete dialogs.

DialogNavigationProvider, DialogNavigationObserver, and useDialogNavigationDismissal directly reuse jg-react-router's implementations and context. Place the observer inside the router, with persistent dialog hosts under the same provider. Navigation dismissal does not create history entries. The host application owns route history and its navigation UI; drawers close on route actions through an explicit DrawerClose composition or application state.

Mount one ConfirmationDialog per document and use useConfirmationDialogStore.getState().openConfirmationDialog(options). This imperative store retains the source's document-wide session API; do not mutate it while server rendering. Completion resets the session before calling the application callback, which receives true on confirmation and undefined on cancellation. The application owns async work and callback errors. Controlled dialog children remain immutable through closing transitions, then release at completion. Mobile return snapshots ignore stale callbacks and are skipped for reduced motion or unsupported browsers.

PageShell, PageHeader, PageHeaderRow, PageHeaderTitleGroup, PageHeaderMetadata, PageTitle, PageDescription, Stack, Inline, and Surface preserve the native semantic props and shared geometry. Supply --jg-ui-shadow-surface alongside the other generic theme roles. The stylesheet supplies source page-gutter spacing and the drawer gutter hooks; it does not reset the document's palette or typography.

## Routing and query recovery

`RouterRoot` retains the source data-router outlet, pending progress, and shared dialog observer. It requires React Router's data router and the shared router peer. Route progress respects the top safe-area inset. It does not add history entries or change page focus/scroll policy; compose `jg-react-router`'s `PageOutlet` when the host wants that behavior. `GlobalErrorBoundary` reads the thrown route error, focuses its labelled recovery main, preserves native refs, and cancels obsolete dialog sessions; `GlobalErrorBoundaryView` accepts an explicit error without router context. Recovery defaults to `jg-sw`'s `updateApp`, with an optional `onRefreshClick`. Unknown errors and recovery failures use scoped safe feedback. Pending refresh and retry actions ignore overlapping clicks.

`QueryBoundary`, `QueryLoader`, `LoadMoreButton`, `QueryErrorAlert`, and `QueryErrorToastr` retain the structural query APIs. The boundary delegates initial resolution to `jg-tanstack-query`'s shared hook: stale unapproved data waits, current data survives background failures, a new `resolutionKey` starts over, and access loss hides data immediately. After access loss, caller approval cannot restore data until every query settles successfully with current data. The nearest `ErrorFeedbackProvider` owns access-loss classification and visible copy; no application registry ships with these packages.

The default error slot is an inline blocking/retained alert. Custom renderers can use a persistent `QueryErrorToastr` for retained content. Supply a unique stable `toastId` per active failure owner and one `Toastr` host per document. Toast publication follows commit effects so a later-mounted host receives initial failures, and stale queued feedback is cancelled. Retry reads the latest committed queries and policy, ignores active fetches/overlapping retries, and keeps failures actionable until recovery; unmount cleanup preserves a same-ID replacement. Retry settles every failed query, including rejected or synchronously throwing adapters. Cancelled errors produce no outage alert or toast. Load-more click callbacks run first and may cancel the request with `preventDefault`.

Default compact pagination and recovery actions preserve their fine-pointer geometry and have at least 44px targets under a coarse pointer. JG's global recovery surface uses the foundation's inverse palette in both themes. Generic consumers set `--jg-ui-inverse-color-scheme` to match their recovery surface (`dark` or `light`); selection and focus use its primary roles. Query clients, network adapters, pagination limits, application code maps, and routing history remain host-owned.

## File uploads and audio input

`FileUpload`, `FileUploadDialog`, `ImageUploadField`, and `AudioInput` retain the pinned source props and callbacks. File uploads reuse `jg-react`'s admission, concurrency, progress, cancellation, and retry queue. The caller supplies validation and transport callbacks; no endpoint, authorization policy, storage service, or transcription provider is included. Upload adapters must honor their abort signal. The image field displays the caller's current image and falls back safely when its preview fails; the caller owns object URL creation and revocation.

The upload dialog finalizes successful results through `onSubmit`, retries finalization without reuploading, and reports abandoned successful items through `onDiscard`. The caller owns remote cleanup and callback failures. Audio input owns microphone tracks, recorder handlers, waveform contexts, intervals, and deferred commands. Obsolete permission/transcription results cannot update a replacement session or call completion after unmount. Recording reset is immediate; closing retains the source's short visual reset delay.

`transcribe` receives the captured recording and returns text. Users can send directly or edit the transcription first; a failed send retries the authored text without transcribing again. Provider operations remain caller-owned and should have their own deadline/cancellation policy. Recording/transcription error callbacks receive diagnostic exceptions, while visible feedback uses the nearest scoped resolver. The seven owned audio codes and stable messages are listed in `errors/README.md`; coded provider exceptions preserve their diagnostic identity. Canceled permission/transcription work stays silent and can be restarted; diagnostic callbacks still run. Optional result callbacks remain optional.

## Documentation

The API reference ships as [API.md](https://unpkg.com/jg-react-ui@0.3.0/API.md), and app-side examples ship as [RECIPES.md](https://unpkg.com/jg-react-ui@0.3.0/RECIPES.md). These personal-use packages are unlisted on the public package website.

## License

MIT.
