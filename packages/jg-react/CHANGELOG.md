# Changelog

## 0.2.0

### Added

- `useFormChanges({ confirmedCommand, currentCommand, normalizeCommand? })`, which tells whether a form's command differs by value from the last confirmed one, with a submit-time check and `confirmChanges` to advance the baseline once a save succeeds.
- `useResendCooldown({ durationSeconds, cooldownKey?, lastAttemptedAt?, storeId? })`, which makes a resend wait after each send, with a countdown. With a key, the deadline survives a reload of the tab in sessionStorage, and stays in memory when storage fails. The first render is always `{ isCoolingDown: false, remainingSeconds: 0 }`, so hydration never mismatches. A duration that isn't a positive safe integer throws `INVALID_COOLDOWN_DURATION`.
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
