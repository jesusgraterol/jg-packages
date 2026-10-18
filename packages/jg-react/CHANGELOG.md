# Changelog

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `useOnlineStatus`, `useDocumentVisibility`, `useBreakpoint`, and `useIsWindowScrolledPast`, each built on `useSyncExternalStore`, with a fixed value in a server render.
- `useBreakpoint` reads Tailwind CSS's default breakpoints, and returns `xs` below `sm`, such as on a phone. `isBreakpointAtLeast` compares two breakpoints.
- `useIsWindowScrolledPast` re-renders only when its answer changes, not on every scroll.
