# jg-personal-react-ui

JG-branded React components backed by the shared jg-react-ui implementation.

## Install

```bash
pnpm add jg-personal-react-ui
```

## Usage

```ts
import { createElement } from 'react';
import { Button } from 'jg-personal-react-ui/components/button';
const saveAction = createElement(Button, { size: 'touch' }, 'Save changes');
```

Import Tailwind once, then `jg-personal-react-ui/styles.css`.

Button, Badge, IconTile, Alert, their composition slots, variants, and public contracts are direct re-exports of `jg-react-ui`. `JgMark` is the decorative JG mark, with `className` for layout and the same fixed artwork as Astro. Import it from the root or `jg-personal-react-ui/components/jg-mark`; pair it with visible text when identifying a brand link.

ErrorFeedbackProvider scopes application-owned error copy and access-loss classification to a React tree. Pass a resolver from `createErrorFeedback` in `jg-exception`; `useErrorFeedbackResolver` reads the nearest policy. Without a provider, unknown diagnostics and codes remain private behind generic copy. Cancellation stays recognizable, and a throwing application policy falls back safely.

## Preferences, theme, and notifications

Compose `UiPreferencesProvider`, `ThemeProvider`, and one `Toastr` host in that order. `ThemeToggleButton` retains the source Button props and request callback. The document theme and Sonner notification channel are document-wide; keep one theme owner and one notification host per document even when independent preference roots are mounted.

Sonner injects its base notification CSS when its browser module loads. Package theme styles remain explicit imports. All JavaScript entries remain importable without browser globals on the server.

The preference provider supports explicit `local`, `read-only`, and `remote` modes. Local mode reads and writes best-effort browser storage and follows matching cross-tab events. Read-only mode exposes a snapshot and denies updates. Remote mode requires complete `initialPreferences` and an async `persistPreferences` adapter: updates are optimistic, saves run sequentially and coalesce newer snapshots, and a rejected save rolls back to the latest authoritative props. The application owns network requests and cache invalidation. Pending requests cannot update storage or show notifications after unmount.

Optional `storageId` defaults to `jg-ui-preferences`. It must be non-empty and contain only ASCII letters, digits, underscores, and hyphens. `getUiPreferencesStorageKey` returns its raw `jg-storage:` key. IDs are captured for the provider lifetime; use a keyed remount to change namespaces. Invalid IDs fail before storage access or initialization-script creation.

Render `ThemeInitializationScript` in the document head before application JavaScript, using the same `storageId` as the provider and your CSP `nonce` when required. Server snapshots use initial props or defaults, then storage synchronizes after hydration. See the recipes for composition and the shared [owned error contracts](https://unpkg.com/jg-react-ui@0.3.0/errors/README.md).

## Controls, forms, and plain text

The forms, menus, tabs, tooltips, copy commands, progress, empty states, typography, tables, links, and inline code are direct exports of `jg-react-ui`. Their refs, native attributes, slots, event aliases, and cancellation behavior share the same implementation and contexts. JG styles bind field, code, menu, and inverse dark-theme roles; set `font-sans bg-background text-foreground` on the application root. Keep compact choice glyphs inside associated label rows of at least 44px, and give overflowing tables a labelled, focusable region with visible focus. See the recipes for compositions.

## Dialogs, drawers, and layout

Dialog, AlertDialog, Drawer, ConfirmationDialog, and page/layout primitives retain the pinned compound APIs. DialogContent requires a size and direct DialogHeader, DialogBody, and optional DialogFooter children; asChild accepts one panel element containing those regions. Use an element that permits the dialog role, such as a div; place a form inside the body and associate fixed submit actions with its form ID. Drawer requires a side, its content requires a size, and its direct regions are ordered header, body, optional footer. AlertDialogContent requires a direct header and footer. Invalid composition and invalid slotted children retain native Error guards.

Medium and large dialogs become full-screen pages on phones, with generated Back and desktop close controls. Body regions own scrolling, while headers and actions stay fixed. Compact modal close controls retain their fine-pointer appearance and have actual 44px targets under a coarse pointer. The default initial focus skips unusable controls; initialFocus and generated control icons/labels remain configurable. Overlay dismissal stays disabled by default for dialogs. isDismissalDisabled blocks on-page dismissal; committed navigation still cancels obsolete dialogs.

DialogNavigationProvider, DialogNavigationObserver, and useDialogNavigationDismissal directly reuse jg-react-router's implementations and context. Place the observer inside the router, with persistent dialog hosts under the same provider. Navigation dismissal does not create history entries. The host application owns route history and its navigation UI; drawers close on route actions through an explicit DrawerClose composition or application state.

Mount one ConfirmationDialog per document and use useConfirmationDialogStore.getState().openConfirmationDialog(options). This imperative store retains the source's document-wide session API; do not mutate it while server rendering. Completion resets the session before calling the application callback, which receives true on confirmation and undefined on cancellation. The application owns async work and callback errors. Controlled dialog children remain immutable through closing transitions, then release at completion. Mobile return snapshots ignore stale callbacks and are skipped for reduced motion or unsupported browsers.

PageShell, PageHeader, PageHeaderRow, PageHeaderTitleGroup, PageHeaderMetadata, PageTitle, PageDescription, Stack, Inline, and Surface preserve the native semantic props and shared geometry. JG binds the generic surface shadow role to the shared foundation. The stylesheet supplies source page-gutter spacing and the drawer gutter hooks; it does not reset the document's palette or typography.

## Documentation

The API reference ships as [API.md](https://unpkg.com/jg-personal-react-ui@0.3.0/API.md), and app-side examples ship as [RECIPES.md](https://unpkg.com/jg-personal-react-ui@0.3.0/RECIPES.md). These personal-use packages are unlisted on the public package website.

## License

MIT.
