# Changelog

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `PageOutlet`, which renders the matched child route in a frame that focuses each new page and scrolls it to the top, restores the position on Back and Forward while the content grows, keeps the page when only the query changes, and holds `history.scrollRestoration` at `manual` while mounted. `IPageOutletProps` takes a `className` and a `transitionKey`.
- `jg-react-router/styles.css`, the frame's width and a 180 ms fade that reduced motion turns off.
- `DialogNavigationProvider`, `DialogNavigationObserver`, and `useDialogNavigationDismissal`, which close the dialogs open when a navigation commits, or when the route fails into its error screen, each session once. The types are `IDialogNavigationDismissalOptions`, `IDialogNavigationObserverProps`, `IDialogNavigationProviderProps`, and `IDialogNavigationSessionReader`.
