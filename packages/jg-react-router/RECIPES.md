# jg-react-router recipes

Layouts that restore scroll on Back and Forward, and dialogs that close when the user navigates away, in React Router apps.

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
