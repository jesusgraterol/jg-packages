# jg-react

React hooks for the browser: online status, page visibility, Tailwind CSS breakpoints, and scroll thresholds, safe in server renders.

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

| Hook                              | Returns                                                 | Re-renders when                      | In a server render |
| --------------------------------- | ------------------------------------------------------- | ------------------------------------ | ------------------ |
| `useOnlineStatus()`               | Whether the browser is online                           | It goes online or offline            | `true`             |
| `useDocumentVisibility()`         | Whether the page is visible                             | Its tab is hidden or shown           | `true`             |
| `useBreakpoint()`                 | Tailwind CSS's breakpoint: `xs` below `sm`, up to `2xl` | The viewport crosses a breakpoint    | `undefined`        |
| `useIsWindowScrolledPast(pixels)` | Whether the window is scrolled further than `pixels`    | The answer changes, not every scroll | `false`            |

Each hook reads the browser through `useSyncExternalStore`, so every component sees the same value in the same render, and a server render gets a fixed value instead of failing. The breakpoints are Tailwind CSS's defaults, in `rem`, read through media queries, so they follow the browser's font size as CSS does. Prefer CSS for layout, and `useBreakpoint` for what CSS can't do, such as rendering a different component.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-react/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-react/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-react/LICENSE)
