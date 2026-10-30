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

Import Tailwind once, then `jg-react-ui/styles.css`. Supply `--background`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--destructive`, `--chart-1` (success), `--chart-2` (warning), `--border`, `--radius`, `--jg-ui-font-sans`, `--jg-ui-font-mono`, and `--jg-ui-shadow-raised` in your own theme. Colors must be complete CSS color values. `.dark` selects dark utility variants; this package supplies no brand palette. For the JG palette and fonts, use `jg-personal-react-ui` instead.

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

## Documentation

The API reference ships as [API.md](https://unpkg.com/jg-react-ui@0.3.0/API.md), and app-side examples ship as [RECIPES.md](https://unpkg.com/jg-react-ui@0.3.0/RECIPES.md). These personal-use packages are unlisted on the public package website.

## License

MIT.
