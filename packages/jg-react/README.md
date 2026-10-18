# jg-react

React hooks for the browser: online status, page visibility, Tailwind CSS breakpoints, scroll thresholds, unsaved form changes, and resend cooldowns, safe in server renders.

## Install

```bash
npm install jg-react
```

It needs React 19.2.4 or later.

## Usage

```ts
import {
  isBreakpointAtLeast,
  useBreakpoint,
  useDocumentVisibility,
  useIsWindowScrolledPast,
  useOnlineStatus,
} from 'jg-react';

export const useLayoutState = () => {
  const isOnline = useOnlineStatus(); // the browser's guess, from its network interfaces
  const isVisible = useDocumentVisibility(); // false while the tab is hidden
  const breakpoint = useBreakpoint(); // 'xs' on a phone, then 'sm' to '2xl'
  const isScrolled = useIsWindowScrolledPast(8);
  return { isOnline, isVisible, isDesktop: isBreakpointAtLeast(breakpoint, 'lg'), isScrolled };
};
```

| Hook                              | Returns                                                                                                 | Re-renders when                      | In a server render                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| `useOnlineStatus()`               | Whether the browser is online                                                                           | It goes online or offline            | `true`                                          |
| `useDocumentVisibility()`         | Whether the page is visible                                                                             | Its tab is hidden or shown           | `true`                                          |
| `useBreakpoint()`                 | Tailwind CSS's breakpoint: `xs` below `sm`, up to `2xl`                                                 | The viewport crosses a breakpoint    | `undefined`                                     |
| `useIsWindowScrolledPast(pixels)` | Whether the window is scrolled further than `pixels`                                                    | The answer changes, not every scroll | `false`                                         |
| `useFormChanges(options)`         | Whether a form's command differs from the last confirmed one, a submit-time check, and `confirmChanges` | The commands or the baseline change  | Compared as usual                               |
| `useResendCooldown(options)`      | Whether a resend must wait, the seconds left, and `startCooldown`                                       | Every second while cooling down      | `{ isCoolingDown: false, remainingSeconds: 0 }` |

Keep a save button disabled until the form holds a real change, and a resend button waiting after each send:

```ts
import { useFormChanges, useResendCooldown } from 'jg-react';

const trim = ({ name }: { name: string }) => ({ name: name.trim() });

export const useProfileEditor = (saved: { name: string }, draft: { name: string }) => {
  // a whitespace-only edit isn't a change, and the baseline advances only once a save succeeds
  const { hasChanges, confirmChanges } = useFormChanges({
    confirmedCommand: saved,
    currentCommand: draft,
    normalizeCommand: trim,
  });
  // the deadline survives a reload of the tab, apart from other accounts and actions
  const resend = useResendCooldown({ durationSeconds: 60, cooldownKey: 'account-a:verify-email' });
  return { canSave: hasChanges, confirmChanges, resend };
};
```

The browser hooks read the browser through `useSyncExternalStore`, so every component sees the same value in the same render, and a server render gets a fixed value instead of failing. The breakpoints are Tailwind CSS's defaults, in `rem`, read through media queries, so they follow the browser's font size as CSS does. Prefer CSS for layout, and `useBreakpoint` for what CSS can't do, such as rendering a different component.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-react/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-react/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-react/LICENSE)
