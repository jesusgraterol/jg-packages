import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { createErrorFeedback } from 'jg-exception';
import { PageOutlet } from 'jg-react-router';

import {
  DEFAULT_UI_PREFERENCES,
  ConfirmationDialog,
  RouterRoot,
  DialogNavigationProvider,
  ErrorFeedbackProvider,
  GlobalErrorBoundary,
  ThemeProvider,
  Toastr,
  UiPreferencesProvider,
  type IUiPreferences,
} from 'jg-personal-react-ui';

import { Gallery } from './gallery.component.js';
import { QueryDemo } from './query-demo/index.js';
import { QueryNext } from './query-next/index.js';
import { MarkdownDemo } from './markdown-demo/index.js';
import { InputDemo } from './input-demo/index.js';
import { LayoutDemo } from './layout-demo/layout-demo.component.js';
import './styles.css';

declare const __JG_UI_STORAGE_ID__: string;
const requestedTheme = new URLSearchParams(location.search).get('theme');
const initialPreferences: IUiPreferences | undefined =
  requestedTheme === 'light' || requestedTheme === 'dark'
    ? { ...DEFAULT_UI_PREFERENCES, theme: requestedTheme }
    : undefined;

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
  },
});
const errorPolicy = createErrorFeedback({
  fallbackMessage: 'The records could not be loaded. Try again.',
  messagesByCode: { GALLERY_ACCESS_REVOKED: 'Access to these records was revoked.' },
  accessDeniedCodes: ['GALLERY_ACCESS_REVOKED'],
});
const router = createBrowserRouter([
  {
    element: <RouterRoot />,
    errorElement: <GlobalErrorBoundary />,
    children: [
      {
        element: <PageOutlet />,
        children: [
          { path: '/', element: <Gallery /> },
          { path: '/layout', element: <LayoutDemo /> },
          { path: '/inputs', element: <InputDemo /> },
          { path: '/markdown', element: <MarkdownDemo /> },
          {
            path: '/queries',
            element: (
              <ErrorFeedbackProvider resolveErrorFeedback={errorPolicy}>
                <QueryDemo />
              </ErrorFeedbackProvider>
            ),
          },
          {
            path: '/queries/next',
            element: <QueryNext />,
            loader: async ({ request }) => {
              await fetch('/route-ready.txt', {
                signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
              });
              return null;
            },
          },
          {
            path: '/route-error',
            loader: () => {
              throw new Error('PRIVATE ROUTE DIAGNOSTICS');
            },
          },
        ],
      },
    ],
  },
]);

const root = document.getElementById('root');
if (root === null) throw new Error('The gallery root is missing.');
createRoot(root).render(
  <StrictMode>
    <ErrorFeedbackProvider>
      <UiPreferencesProvider
        mode="local"
        storageId={__JG_UI_STORAGE_ID__}
        {...(initialPreferences === undefined ? {} : { initialPreferences })}
      >
        <ThemeProvider>
          <QueryClientProvider client={client}>
            <DialogNavigationProvider>
              <RouterProvider router={router} />
              <ConfirmationDialog />
            </DialogNavigationProvider>
            <Toastr
              closeButton
              toastOptions={{ duration: Infinity }}
            />
          </QueryClientProvider>
        </ThemeProvider>
      </UiPreferencesProvider>
    </ErrorFeedbackProvider>
  </StrictMode>,
);
