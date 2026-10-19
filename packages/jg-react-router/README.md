# jg-react-router

React Router helpers: a page outlet that focuses each new page and restores scroll on Back and Forward, and dialogs that close when the route changes.

## Install

```bash
npm install jg-react-router
```

It needs `react` 19.2 and `react-router` 7.14 or later.

## Usage

### A page outlet

`PageOutlet` renders the matched child route in a frame. Each new page gets focus, without scrolling, so assistive technology starts reading at it, and the window scrolls to the top. Back and Forward restore where the page was scrolled instead, retrying while its content loads, until the user scrolls or types. A navigation that changes only the query, such as a filter, keeps the page and its scroll.

```tsx
import { createBrowserRouter } from 'react-router';
import { PageOutlet } from 'jg-react-router';
import 'jg-react-router/styles.css';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PageOutlet className="app-main" />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
```

The stylesheet gives the frame its full width and a short fade, which reduced motion turns off. It sits in the `base` cascade layer, so the app's own styles and Tailwind CSS utilities override it. A layout whose nested routes should share one frame, such as a settings page with tabs, passes its own `transitionKey`.

### Closing dialogs when the route changes

A dialog left open across a navigation covers the new page. `DialogNavigationProvider` closes the dialogs that are open when a navigation commits, before the new page's effects run:

```tsx
import { RouterProvider } from 'react-router';
import { DialogNavigationProvider } from 'jg-react-router';

export const App = () => (
  <DialogNavigationProvider>
    <RouterProvider router={router} />
    <ConfirmDialogHost />
  </DialogNavigationProvider>
);
```

The router's root route renders `<DialogNavigationObserver />`, and its error element `<DialogNavigationObserver isErrorScreen />`, so a route error closes them too. Each dialog host calls `useDialogNavigationDismissal` with a reader for its open session, an object that stays the same while the dialog is open, and a function that closes it. Hosts that share a session close it once, and without a provider the hook does nothing.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-react-router/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-react-router/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-react-router/LICENSE)
