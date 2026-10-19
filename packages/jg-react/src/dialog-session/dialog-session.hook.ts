import { useSyncExternalStore } from 'react';

import type { IDialogSession, IDialogSessionSnapshot } from './types.js';

// a server never has an open session
const getServerSnapshot = (): null => null;

/**
 * Reads a dialog session's open session, re-rendering when one opens or closes, such as in the
 * component that renders the dialog. A server render reads null.
 * @param session The dialog's sessions, from createDialogSession.
 * @returns The open session, the same object while it lasts, or null.
 * @example
 * import { createDialogSession, useDialogSession } from 'jg-react';
 *
 * export const confirmDialog = createDialogSession<{ title: string }, boolean>();
 *
 * // in the component that renders the dialog
 * export const useConfirmDialog = () => {
 *   const session = useDialogSession(confirmDialog);
 *   return {
 *     isOpen: session !== null,
 *     title: session?.options.title ?? '',
 *     // the id keeps a click on a dialog that already closed from closing a newer one
 *     confirm: () => confirmDialog.close(true, session?.id),
 *     cancel: () => confirmDialog.close(false, session?.id),
 *   };
 * };
 */
export const useDialogSession = <TOptions, TResult>(
  session: IDialogSession<TOptions, TResult>,
): IDialogSessionSnapshot<TOptions> | null =>
  useSyncExternalStore(session.subscribe, session.getSnapshot, getServerSnapshot);
