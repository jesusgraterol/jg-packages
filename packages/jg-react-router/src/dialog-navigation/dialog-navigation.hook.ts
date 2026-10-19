import { useContext, useLayoutEffect, useRef } from 'react';

import { DialogNavigationContext } from './dialog-navigation.context.js';
import type { IDialogNavigationDismissalOptions } from './types.js';

/**
 * Closes a dialog when a navigation commits while its session is open, through the surrounding
 * DialogNavigationProvider. It always calls the latest `getSession` and `onDismiss` the component
 * committed, so they needn't be stable, and it closes the session only if `getSession` still
 * returns the one that was open when the navigation committed. Outside a provider, it does
 * nothing.
 * @param options How to read the dialog's session, and how to close it.
 * @example
 * import { useState } from 'react';
 * import { useDialogNavigationDismissal } from 'jg-react-router';
 *
 * export const useConfirmDialog = () => {
 *   const [session, setSession] = useState<object | null>(null);
 *   useDialogNavigationDismissal({
 *     getSession: () => session,
 *     onDismiss: () => {
 *       setSession(null);
 *     },
 *   });
 *   return { isOpen: session !== null, open: () => setSession({}), close: () => setSession(null) };
 * };
 */
export const useDialogNavigationDismissal = (options: IDialogNavigationDismissalOptions): void => {
  const context = useContext(DialogNavigationContext);
  const committedOptions = useRef(options);

  useLayoutEffect(() => {
    committedOptions.current = options;
  });

  useLayoutEffect(
    () =>
      context?.register({
        getSession: () => committedOptions.current.getSession(),
        onDismiss: () => {
          committedOptions.current.onDismiss();
        },
      }),
    [context],
  );
};
