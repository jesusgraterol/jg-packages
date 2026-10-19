import { type ReactElement, useCallback, useMemo, useRef } from 'react';

import { DialogNavigationContext } from './dialog-navigation.context.js';
import type {
  IDialogNavigationContext,
  IDialogNavigationDismissalOptions,
  IDialogNavigationLocation,
  IDialogNavigationProviderProps,
} from './types.js';

/**
 * Closes the dialogs that are open when a navigation commits, without touching history: each
 * dialog host registers with useDialogNavigationDismissal, and a DialogNavigationObserver inside
 * the router reports each committed location. It reads every open session before closing any, so
 * a dialog that closes or replaces another can't make the provider skip or close the wrong one,
 * and hosts that share a session close it once. Without a provider, the hook and the observer do
 * nothing.
 * @param props The router and the dialog hosts.
 * @returns The provider.
 * @example
 * import { createElement } from 'react';
 * import { RouterProvider, type createBrowserRouter } from 'react-router';
 * import { DialogNavigationProvider } from 'jg-react-router';
 *
 * declare const router: ReturnType<typeof createBrowserRouter>;
 * declare const DialogHost: () => null;
 *
 * // the router's root route renders <DialogNavigationObserver />
 * export const App = () =>
 *   createElement(
 *     DialogNavigationProvider,
 *     null,
 *     createElement(RouterProvider, { router }),
 *     createElement(DialogHost),
 *   );
 */
export const DialogNavigationProvider = ({
  children,
}: IDialogNavigationProviderProps): ReactElement => {
  const registrations = useRef(new Set<IDialogNavigationDismissalOptions>());
  const previousLocation = useRef<IDialogNavigationLocation | null>(null);

  const register = useCallback<IDialogNavigationContext['register']>((options) => {
    registrations.current.add(options);
    return () => {
      registrations.current.delete(options);
    };
  }, []);

  const observe = useCallback<IDialogNavigationContext['observe']>((location) => {
    const previous = previousLocation.current;
    previousLocation.current = location;
    // the first location, a re-render of the same entry, or leaving an error screen for its own
    // entry closes nothing; reaching an error screen on the same entry does
    if (
      previous === null ||
      (previous.key === location.key && (previous.isErrorScreen || !location.isErrorScreen))
    ) {
      return;
    }

    // every session is read before any callback can close or replace another one
    const outgoing = Array.from(registrations.current, (registration) => ({
      registration,
      session: registration.getSession(),
    }));
    const handledSessions = new Set<object>();
    for (const { registration, session } of outgoing) {
      if (
        session === null ||
        handledSessions.has(session) ||
        !registrations.current.has(registration) ||
        registration.getSession() !== session
      ) {
        continue;
      }
      handledSessions.add(session);
      registration.onDismiss();
    }
  }, []);

  const context = useMemo(() => ({ register, observe }), [register, observe]);

  return <DialogNavigationContext value={context}>{children}</DialogNavigationContext>;
};
