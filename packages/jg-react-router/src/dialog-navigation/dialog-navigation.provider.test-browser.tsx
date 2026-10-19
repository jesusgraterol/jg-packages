import { act, cleanup, render } from '@testing-library/react';
import { type ReactElement, type ReactNode, StrictMode, useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  DialogNavigationObserver,
  DialogNavigationProvider,
  type IDialogNavigationDismissalOptions,
  useDialogNavigationDismissal,
} from './index.js';

const Participant = (props: IDialogNavigationDismissalOptions): null => {
  useDialogNavigationDismissal(props);
  return null;
};

let router: ReturnType<typeof createMemoryRouter>;
let rerender: ((ui: ReactNode) => void) | undefined;

beforeEach(() => {
  router = createMemoryRouter([{ path: '*', element: <DialogNavigationObserver /> }]);
  rerender = undefined;
});

afterEach(() => {
  cleanup();
  router.dispose();
  vi.restoreAllMocks();
});

/**
 * Renders, or renders again, the router and the participants under one provider, in StrictMode.
 * @param children The participants.
 */
const renderWithProvider = (children: ReactNode): void => {
  const ui = (
    <StrictMode>
      <DialogNavigationProvider>
        <RouterProvider router={router} />
        {children}
      </DialogNavigationProvider>
    </StrictMode>
  );
  if (rerender === undefined) {
    ({ rerender } = render(ui));
  } else {
    rerender(ui);
  }
};

test('reads every outgoing session before closing any, and skips a replaced one', async () => {
  const firstSession = {};
  const oldSecondSession = {};
  const replacementSession = {};
  let secondSession = oldSecondSession;
  const reads: object[] = [];
  const onSecondDismiss = vi.fn();
  const onFirstDismiss = vi.fn(() => {
    expect(reads).toContain(oldSecondSession);
    secondSession = replacementSession;
  });
  renderWithProvider(
    <>
      <Participant
        getSession={() => firstSession}
        onDismiss={onFirstDismiss}
      />
      <Participant
        getSession={() => {
          reads.push(secondSession);
          return secondSession;
        }}
        onDismiss={onSecondDismiss}
      />
    </>,
  );
  expect(onFirstDismiss).not.toHaveBeenCalled();

  await act(() => router.navigate('/next'));

  expect(onFirstDismiss).toHaveBeenCalledTimes(1);
  expect(onSecondDismiss).not.toHaveBeenCalled();
});

test('closes a session hosts share once, and ignores a host that was closed', async () => {
  const session = {};
  const dismiss = vi.fn();
  let lateSession: object | null = null;
  const lateDismiss = vi.fn();
  renderWithProvider(
    <>
      <Participant
        getSession={() => session}
        onDismiss={() => {
          dismiss();
          lateSession = {};
        }}
      />
      <Participant
        getSession={() => session}
        onDismiss={dismiss}
      />
      <Participant
        getSession={() => lateSession}
        onDismiss={lateDismiss}
      />
    </>,
  );

  await act(() => router.navigate('/next'));

  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(lateDismiss).not.toHaveBeenCalled();
});

test('uses the latest committed callbacks, and unregisters on unmount', async () => {
  const session = {};
  const stale = vi.fn();
  const current = vi.fn();
  renderWithProvider(
    <Participant
      getSession={() => session}
      onDismiss={stale}
    />,
  );
  renderWithProvider(
    <Participant
      getSession={() => session}
      onDismiss={current}
    />,
  );

  await act(() => router.navigate('/next'));

  expect(stale).not.toHaveBeenCalled();
  expect(current).toHaveBeenCalledTimes(1);

  renderWithProvider(null);
  await act(() => router.navigate('/again'));

  expect(current).toHaveBeenCalledTimes(1);
});

test('does not close a session an earlier callback already closed', async () => {
  let session: object | null = {};
  const dismiss = vi.fn();
  const first = {};
  renderWithProvider(
    <>
      <Participant
        getSession={() => first}
        onDismiss={() => {
          session = null;
        }}
      />
      <Participant
        getSession={() => session}
        onDismiss={dismiss}
      />
    </>,
  );

  await act(() => router.navigate('/next'));

  expect(dismiss).not.toHaveBeenCalled();
});

test('keeps nested providers apart, even when their hosts share a session', async () => {
  const session = {};
  const observedDismiss = vi.fn();
  const isolatedDismiss = vi.fn();
  renderWithProvider(
    <>
      <Participant
        getSession={() => session}
        onDismiss={observedDismiss}
      />
      <DialogNavigationProvider>
        <Participant
          getSession={() => session}
          onDismiss={isolatedDismiss}
        />
      </DialogNavigationProvider>
    </>,
  );

  await act(() => router.navigate('/next'));

  expect(observedDismiss).toHaveBeenCalledTimes(1);
  expect(isolatedDismiss).not.toHaveBeenCalled();
});

// a host rendered before the router registers again, under StrictMode, before the observer reports
// the first entry a second time
test('closes nothing when the same entry is reported again', () => {
  const session = {};
  const dismiss = vi.fn();

  render(
    <StrictMode>
      <DialogNavigationProvider>
        <Participant
          getSession={() => session}
          onDismiss={dismiss}
        />
        <RouterProvider router={router} />
      </DialogNavigationProvider>
    </StrictMode>,
  );

  expect(dismiss).not.toHaveBeenCalled();
});

test('needs no router and closes nothing without a provider', () => {
  const getSession = vi.fn(() => ({}));
  const dismiss = vi.fn();

  render(
    <>
      <DialogNavigationObserver />
      <Participant
        getSession={getSession}
        onDismiss={dismiss}
      />
    </>,
  );

  expect(getSession).not.toHaveBeenCalled();
  expect(dismiss).not.toHaveBeenCalled();
});

// StrictMode runs the error screen's observer twice as it mounts, so a second report of the same
// failed entry must close nothing more
test('closes dialogs once when the same entry fails into the error screen', () => {
  // React reports the error the route's boundary catches
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  let failPage: () => void = () => undefined;
  const FailingPage = (): ReactElement => {
    const [hasFailed, setHasFailed] = useState(false);
    failPage = () => {
      setHasFailed(true);
    };
    if (hasFailed) {
      throw new Error('The page failed.');
    }
    return <DialogNavigationObserver />;
  };
  router.dispose();
  router = createMemoryRouter([
    {
      path: '*',
      element: <FailingPage />,
      errorElement: <DialogNavigationObserver isErrorScreen />,
    },
  ]);
  const session = {};
  const dismiss = vi.fn();
  renderWithProvider(
    <Participant
      getSession={() => session}
      onDismiss={dismiss}
    />,
  );

  act(() => {
    failPage();
  });

  expect(dismiss).toHaveBeenCalledTimes(1);
});
