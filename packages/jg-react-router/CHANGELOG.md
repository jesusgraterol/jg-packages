# Changelog

## 0.3.0

### Added

- `useSearchParamState({ params, schema, defaultValue, unknownParams? })`, which keeps typed state in the URL's search parameters, each key held once or repeated. It reads them through the schema with the defaults filling missing keys, falling back to the defaults when the schema rejects them, replaces a URL that isn't canonical once, keeping the router state and the hash, and never loops on a schema that doesn't round-trip. Its setter keeps its identity, composes the changes of one tick into one navigation, pushes unless given `replace`, and skips a change that leaves the search as it is. A value the URL can't hold throws `INVALID_SEARCH_PARAM_VALUE`.
- `ERRORS`, `ISchema`, `ISearchParamKind`, `ISearchParamKinds`, `ISetSearchParamState`, `ISetSearchParamStateOptions`, and `IUseSearchParamStateOptions`.

### Changed

- Depends on `jg-exception`, for its coded errors.

## 0.2.0

### Added

- `createPageRouteObject(route, { HydrateFallback?, wrapElement? })`, which turns a page route's definition, with its path, title, description, and component or lazy loader, into a React Router route object whose element receives exactly `{ title, description }` and whose handle carries them. `createPageRouteMetadata`, `createPageRouteHandle`, `createPageRouteElement`, and `createLazyPageComponent` build its parts.
- `usePageRouteMetadata()`, which gives the deepest matched page route's title and description, or `null`.
- `IPageRouteMetadata`, `IPageRouteHandle`, `IPageRouteComponentProps`, `IPageRouteLazyFunction`, `IPageRouteDefinition`, and `ICreatePageRouteObjectOptions`.
- A recipe for a document title from the route map.

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `PageOutlet`, which renders the matched child route in a frame that focuses each new page and scrolls it to the top, restores the position on Back and Forward while the content grows, keeps the page when only the query changes, and holds `history.scrollRestoration` at `manual` while mounted. `IPageOutletProps` takes a `className` and a `transitionKey`.
- `jg-react-router/styles.css`, the frame's width and a 180 ms fade that reduced motion turns off.
- `DialogNavigationProvider`, `DialogNavigationObserver`, and `useDialogNavigationDismissal`, which close the dialogs open when a navigation commits, or when the route fails into its error screen, each session once. The types are `IDialogNavigationDismissalOptions`, `IDialogNavigationObserverProps`, `IDialogNavigationProviderProps`, and `IDialogNavigationSessionReader`.
