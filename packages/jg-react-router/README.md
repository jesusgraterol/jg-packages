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

### Page routes with their metadata

Keep each page's path, title, and description in one route map, and let `createPageRouteObject` build the router's routes from it. Each page component receives exactly `{ title, description }` as its props, and `usePageRouteMetadata` reads the deepest matched page's, such as for the document's title:

```tsx
import { createBrowserRouter } from 'react-router';
import {
  createLazyPageComponent,
  createPageRouteObject,
  type IPageRouteDefinition,
  PageOutlet,
} from 'jg-react-router';

const PAGES: IPageRouteDefinition<{ navigationLabel: string }>[] = [
  {
    path: '/',
    title: 'Home',
    description: 'Your dashboard.',
    navigationLabel: 'Home',
    Component: HomePage,
  },
  {
    path: '/settings',
    title: 'Settings',
    description: 'Your account and notifications.',
    navigationLabel: 'Settings',
    lazy: createLazyPageComponent(() => import('./settings.page.js')), // loads when visited
  },
];

export const router = createBrowserRouter([
  { element: <PageOutlet />, children: PAGES.map((page) => createPageRouteObject(page)) },
]);
```

An eager page becomes `{ path, handle, element }`, and a lazy one `{ path, handle, HydrateFallback, lazy }`, whose `lazy` resolves to the element. The `wrapElement` option wraps every page's element, such as in an error boundary, and `HydrateFallback` shows while a lazy page loads during hydration. `usePageRouteMetadata` skips a handle without a string title and description, and gives `null` when no matched route is a page.

### Route code that couldn't load

After a deploy, the scripts an open tab's build names are gone, and offline they can't be fetched, so a lazy route's import fails. `createLazyRoute` builds a route's `lazy` function from a module's named export, and rejects that failure with `ROUTE_MODULE_UNAVAILABLE`, which the route's error element can tell from the page's own errors:

```tsx
import { useRouteError } from 'react-router';
import { hasErrorCode } from 'jg-exception';
import { createLazyRoute, ERRORS } from 'jg-react-router';

const RouteError = () => {
  const error = useRouteError();
  if (!hasErrorCode(error, ERRORS.ROUTE_MODULE_UNAVAILABLE)) throw error;
  return <ReloadNotice />; // the page opens once the app reloads
};

const routes = [
  {
    path: '/settings',
    errorElement: <RouteError />,
    lazy: createLazyRoute(
      () => import('./settings.page.js'),
      (module) => module.SettingsPage,
    ),
  },
];
```

`loadRouteModule(load)` is the same check for any module a route loads. Both reject an import that resolves with no module too, as Vite's does once a `vite:preloadError` handler prevented the error, and keep a failed import as the exception's `cause`.

### URL state

`useSearchParamState` keeps typed state, such as a list's filters and page, in the URL's search parameters, so a reload, a shared link, and Back all show the same list:

```ts
import { useSearchParamState } from 'jg-react-router';
import { z } from 'zod';

const FiltersSchema = z.object({
  query: z.string(),
  page: z.coerce.number().int().min(1),
  status: z.array(z.enum(['paid', 'refunded'])),
});

const [filters, setFilters] = useSearchParamState({
  params: { query: 'one', page: 'one', status: 'many' }, // ?status=paid&status=refunded
  schema: FiltersSchema, // a rejected URL reads as the defaults
  defaultValue: { query: '', page: 1, status: [] }, // left out of the URL
});

setFilters((current) => ({ ...current, page: current.page + 1 })); // pushes ?page=2
setFilters({ ...filters, query: 'card', page: 1 }, { replace: true }); // replaces the entry
```

The schema reads the URL's strings, with the defaults filling missing keys, so give numbers and booleans `z.coerce` or a preprocess step. The URL holds the canonical form, without keys at their defaults, and a URL that isn't canonical, such as an old bookmark, is replaced once, keeping the router state and the hash, so the way back to the previous page isn't lost. Components that own keys in the same URL build on each other's repair, so two that own the same keys replace it once. The value keeps its identity while its keys don't change, and the setter always keeps its identity. Changes made in the same tick compose, each updater seeing the one before, and navigate once; a change that leaves the search as it is navigates nowhere. Parameters the state doesn't own, such as `utm_source`, stay, unless `unknownParams` is `'remove'`. A value the URL can't hold, such as an object or `NaN`, throws `INVALID_SEARCH_PARAM_VALUE` where it's set.

Each change is a navigation, so `DialogNavigationProvider` closes the dialogs open at the time, as for any other navigation.

### Dialogs in the URL

`useSearchParamDialog` keeps a page's open dialog in one search parameter, holding the ID of what it shows, so a link or a reload opens it, and Back, or the system back gesture on a phone, closes it:

```tsx
import { useSearchParamDialog } from 'jg-react-router';

const { openId, open, close } = useSearchParamDialog('event'); // ?event=event-7
// <button onClick={() => open(event.id)}>, and <EventDialog id={openId} open={openId !== ''} onClose={close} />
```

Opening adds a history entry, marked in its router state, and `close` goes back past it, so the dialog never lingers in history, whichever component opens or closes it. A dialog the URL opened as the page loaded closes in place, replacing the entry and keeping the other parameters. An empty ID, or one longer than 4,096 characters, reads as closed. These are navigations, so a dialog that `DialogNavigationProvider` closes takes a session reader that returns `null`, and a link that moves it to another ID keeps the router state, so Back still closes it.

### Page return

`createPageReturn` gives a detail page a way back to the page it was opened from, such as a filtered list, kept in the router state rather than the URL. The app says which pages it returns to, with their labels and the query each keeps:

```ts
import { createPageReturn, retainSearchParams, usePageReturn } from 'jg-react-router';
import { z } from 'zod';

const LABELS: Record<string, string> = { '/payments': 'Payments', '/projects': 'All projects' };

export const pageReturn = createPageReturn({
  excludedPaths: ['/sign-in'], // never a way back
  resolveOrigin: (url) => {
    const label = Object.hasOwn(LABELS, url.pathname) ? LABELS[url.pathname] : undefined;
    const search = retainSearchParams(url.searchParams, {
      status: { schema: z.enum(['all', 'failed']), defaultValue: 'all' }, // left out at all
    });
    return label === undefined || search === null
      ? null
      : { href: `${url.pathname}${search.size > 0 ? `?${search.toString()}` : ''}`, label };
  },
});

// on the list, linking to a payment
const linkState = pageReturn.createState(`${location.pathname}${location.search}`, location.state);

// on the payment, with its own back link to /payments
const { returnTo, returnState } = usePageReturn(pageReturn, { parentHref: '/payments' });
// returnTo: { href: '/payments?status=failed', label: 'Payments' }, or null
```

An origin must be a safe internal path, not under `excludedPaths`, that `resolveOrigin` accepts, and its hash is dropped. `retainSearchParams` keeps only the parameters its rules list, each at most once and valid, leaving out one at its default, so a search box's private text never reaches the state; a repeated or invalid parameter offers no way back. `createState` replaces an earlier origin and keeps the rest of the state. `usePageReturn` offers no way back to the parent, the current page, or its pathname, and gives the state to return with without the origin, so the way back is used once. A state that isn't valid offers none.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-react-router/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-react-router/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-react-router/LICENSE)
