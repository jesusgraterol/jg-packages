import type {
  IDialogSession,
  IDialogSessionOpenInit,
  IDialogSessionOptions,
  IDialogSessionSnapshot,
} from './types.js';
import { readFocusedElement, scheduleFocusReturn } from './utilities.js';

/**
 * Creates one dialog's sessions, outside React, so any code can open the dialog and await its
 * result, such as a confirmation, while one host component renders it. At most one session is
 * open: opening another resolves the open one's caller with undefined (`whileOpen: 'replace'`, the
 * default), or resolves the new call with undefined (`'keep'`), so no caller waits forever. A
 * promise never rejects. A close can name the session's id, so a stale close, such as from a
 * dialog that already closed, does nothing. One frame after a close, focus returns to the element
 * the session was opened from, when it's still in the page, enabled, and not inert, no other
 * session opened, and focus is lost on the body. `useDialogSession` reads the open session.
 * @param options What opening does while a session is open, and whether focus returns on close.
 * @returns The session's functions.
 * @example
 * import { createDialogSession } from 'jg-react';
 *
 * export const confirmDialog = createDialogSession<{ title: string }, boolean>();
 *
 * // anywhere, such as a delete button's handler
 * const isConfirmed = await confirmDialog.open({ title: 'Delete the project?' });
 * if (isConfirmed === true) {
 *   // delete it
 * }
 */
export const createDialogSession = <TOptions, TResult = boolean>({
  whileOpen = 'replace',
  restoreFocus = true,
}: IDialogSessionOptions = {}): IDialogSession<TOptions, TResult> => {
  const listeners = new Set<() => void>();
  let snapshot: IDialogSessionSnapshot<TOptions> | null = null;
  let resolveOpen: ((result: TResult | undefined) => void) | undefined;
  let nextId = 1;

  const notify = (): void => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  /**
   * Ends the open session, resolving its caller, without notifying.
   * @param result What the caller's promise resolves to.
   * @returns The session that ended.
   */
  const end = (result: TResult | undefined): IDialogSessionSnapshot<TOptions> | null => {
    const ended = snapshot;
    const resolve = resolveOpen;
    snapshot = null;
    resolveOpen = undefined;
    resolve?.(result);
    return ended;
  };

  const open = (
    options: TOptions,
    init: IDialogSessionOpenInit = {},
  ): Promise<TResult | undefined> => {
    if (snapshot !== null && whileOpen === 'keep') {
      return Promise.resolve(undefined);
    }
    // the replaced session's element, since focus is inside its dialog now
    const replaced = end(undefined);
    const returnFocusTo =
      init.returnFocusTo === undefined
        ? (replaced?.returnFocusTo ?? readFocusedElement())
        : init.returnFocusTo;
    const session: IDialogSessionSnapshot<TOptions> = { id: nextId, options, returnFocusTo };
    nextId += 1;
    const promise = new Promise<TResult | undefined>((resolve) => {
      resolveOpen = resolve;
    });
    snapshot = session;
    notify();
    return promise;
  };

  const close = (result?: TResult, id?: number): boolean => {
    const current = snapshot;
    if (current === null || (id !== undefined && id !== current.id)) {
      return false;
    }
    end(result);
    notify();
    if (restoreFocus && current.returnFocusTo !== null) {
      scheduleFocusReturn(current.returnFocusTo, () => snapshot !== null);
    }
    return true;
  };

  return {
    open,
    close,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
