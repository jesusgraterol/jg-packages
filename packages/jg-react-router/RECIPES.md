# jg-react-router recipes

Layouts that restore scroll on Back and Forward, dialogs that close when the user navigates away, and titles from a route map, in React Router apps.

## A layout route that restores scroll

An app shell whose header stays put while its pages change. The outlet takes the layout classes, and the settings section passes its own `transitionKey`, so moving between its tabs keeps the frame, its focus, and its scroll.

```tsx
import { createBrowserRouter, Link } from 'react-router';
import { PageOutlet } from 'jg-react-router';

// the app's pages
declare const ProjectsPage: () => null;
declare const ProfileTab: () => null;
declare const BillingTab: () => null;

const AppShell = () => (
  <div className="flex min-h-dvh flex-col">
    <header className="border-b">
      <nav>
        <Link to="/">Projects</Link> <Link to="/settings/profile">Settings</Link>
      </nav>
    </header>
    <PageOutlet className="mx-auto flex max-w-5xl flex-1 flex-col px-4" />
  </div>
);

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <ProjectsPage /> },
      {
        path: '/settings',
        element: <PageOutlet transitionKey="settings" />,
        children: [
          { path: 'profile', element: <ProfileTab /> },
          { path: 'billing', element: <BillingTab /> },
        ],
      },
    ],
  },
]);
```

Import `jg-react-router/styles.css` once, such as in the app's entry, for the frame's width and fade. The outlet remembers the last 128 positions in memory, so a reload starts at the top.

## Closing dialogs when the route changes

A confirmation dialog that should close when a link inside it, the Back button, or a redirect takes the user elsewhere. Its session is a new object each time it opens, so a navigation only closes the dialog that was open when it committed, never one opened after it.

```tsx
import { useState } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router';
import {
  DialogNavigationObserver,
  DialogNavigationProvider,
  useDialogNavigationDismissal,
} from 'jg-react-router';

// the app's pages
declare const ProjectsPage: () => null;

const ConfirmDialog = () => {
  const [session, setSession] = useState<{ message: string } | null>(null);
  useDialogNavigationDismissal({
    getSession: () => session,
    onDismiss: () => {
      setSession(null);
    },
  });
  return (
    <>
      <button
        type="button"
        onClick={() => setSession({ message: 'Archive this project?' })}
      >
        Archive
      </button>
      <dialog open={session !== null}>
        <p>{session?.message}</p>
        <button
          type="button"
          onClick={() => setSession(null)}
        >
          Cancel
        </button>
      </dialog>
    </>
  );
};

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <>
        <DialogNavigationObserver />
        <Outlet />
      </>
    ),
    errorElement: <DialogNavigationObserver isErrorScreen />,
    children: [{ index: true, element: <ProjectsPage /> }],
  },
]);

export const App = () => (
  <DialogNavigationProvider>
    <RouterProvider router={router} />
    <ConfirmDialog />
  </DialogNavigationProvider>
);
```

The provider closes dialogs without touching history, so closing one never moves the user back. Inside a nested `DialogNavigationProvider`, dialogs follow only that provider's observer.

## A document title from the route map

Keep every page's title and description next to its path, and set the document's title and meta description from the matched page in one place, the root layout:

```tsx
import { useEffect } from 'react';
import { createBrowserRouter } from 'react-router';
import {
  createPageRouteObject,
  type IPageRouteComponentProps,
  PageOutlet,
  usePageRouteMetadata,
} from 'jg-react-router';

const SettingsPage = ({ title }: IPageRouteComponentProps) => <h1>{title}</h1>;

const RootLayout = () => {
  const pageMetadata = usePageRouteMetadata();
  useEffect(() => {
    document.title = pageMetadata === null ? 'Acme' : `${pageMetadata.title} | Acme`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', pageMetadata?.description ?? '');
  }, [pageMetadata]);
  return <PageOutlet />;
};

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      createPageRouteObject({
        path: '/settings',
        title: 'Settings',
        description: 'Your account and notifications.',
        Component: SettingsPage,
      }),
    ],
  },
]);
```

The page's heading and the document's title come from the same entry, so they can't drift apart, and a route without page metadata, such as a redirect, leaves the default title.

## List filters in the URL, with a way back

A payments list keeps its filters in the URL, so a reload and a shared link show the same list, and each payment it opens offers a link back to that exact list, with its filters, instead of the unfiltered one:

```tsx
import { Link, useLocation } from 'react-router';
import {
  createPageReturn,
  retainSearchParams,
  usePageReturn,
  useSearchParamState,
} from 'jg-react-router';
import { z } from 'zod';

const STATUSES = ['all', 'paid', 'failed'] as const;

const PaymentFiltersSchema = z.object({
  status: z.enum(STATUSES),
  page: z.coerce.number().int().min(1),
});

export const pageReturn = createPageReturn({
  resolveOrigin: (url) => {
    if (url.pathname !== '/payments') {
      return null;
    }
    // the same rules the list reads its filters with
    const search = retainSearchParams(url.searchParams, {
      status: { schema: z.enum(STATUSES), defaultValue: 'all' },
      page: { schema: z.coerce.number().int().min(1), defaultValue: '1' },
    });
    return search === null
      ? null
      : { href: `/payments${search.size > 0 ? `?${search.toString()}` : ''}`, label: 'Payments' };
  },
});

export const PaymentsPage = ({ paymentIds }: { paymentIds: string[] }) => {
  const location = useLocation();
  const [filters, setFilters] = useSearchParamState({
    params: { status: 'one', page: 'one' },
    schema: PaymentFiltersSchema,
    defaultValue: { status: 'all', page: 1 },
  });
  // the link state records this exact list as the way back
  const linkState = pageReturn.createState(
    `${location.pathname}${location.search}`,
    location.state,
  );
  return (
    <section>
      <select
        aria-label="Status"
        value={filters.status}
        onChange={(event) => {
          setFilters({ status: z.enum(STATUSES).parse(event.target.value), page: 1 });
        }}
      >
        {STATUSES.map((status) => (
          <option key={status}>{status}</option>
        ))}
      </select>
      <ul>
        {paymentIds.map((id) => (
          <li key={id}>
            <Link
              to={`/payments/${id}`}
              state={linkState}
            >
              Payment {id}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export const PaymentPage = () => {
  const { returnTo, returnState } = usePageReturn(pageReturn, { parentHref: '/payments' });
  return (
    <Link
      to={returnTo?.href ?? '/payments'}
      state={returnState}
    >
      Back to {returnTo?.label ?? 'Payments'}
    </Link>
  );
};
```

The way back is in the router state, so it lasts across a reload of the payment but not a shared link, which opens the payment with its plain back link. A status change resets the page, and pushes a history entry, so Back returns to the previous filters.
