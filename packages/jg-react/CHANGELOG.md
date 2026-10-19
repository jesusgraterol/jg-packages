# Changelog

## 0.3.0

### Added

- `useCopyFeedback({ durationSeconds?, onError? })`, which shows that a copy worked for a moment. Its `copy(write)` calls `write` before awaiting anything, so a clipboard write stays inside the click, ignores a copy while another runs, resolves to whether it worked without ever rejecting, and passes a failure to the latest `onError`. Nothing changes after unmount. A duration that isn't positive and finite throws `INVALID_COPY_FEEDBACK_DURATION`.
- `DEFAULT_COPY_FEEDBACK_SECONDS`, `IUseCopyFeedbackOptions`, and `IUseCopyFeedbackResult`.
- A recipe for a copy button that explains a failed copy by jg-clipboard's error code.

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
