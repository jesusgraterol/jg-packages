import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { flushSync } from 'react-dom';
import type { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { prefersReducedMotion } from 'jg-utilities';

/**
 * Retains an open mobile surface until the browser captures it, then reveals the returning page.
 * @param open The requested state, independent of the briefly retained visual state.
 * @param actionsRef The existing Base UI actions used to finish the captured popup's lifecycle.
 * @param onOpenChangeComplete The completion callback, deferred until the return animation finishes.
 * @returns The rendered open state, popup identity, and lifecycle handlers.
 */
export const useDialogMotion = (
  open: boolean,
  actionsRef: React.RefObject<BaseDialog.Root.Actions | null>,
  onOpenChangeComplete: (open: boolean) => void,
) => {
  const dialogId = useId();
  const [retainedOpen, setRetainedOpen] = useState(open);
  const transitionRef = useRef<ViewTransition | null>(null);
  const requestedOpenRef = useRef(open);
  const completionRef = useRef(onOpenChangeComplete);
  const pendingCompletionRef = useRef(false);
  const skipReturnRef = useRef(false);

  const clearMarker = useCallback((): void => {
    if (document.documentElement.getAttribute('data-dialog-return') === dialogId) {
      document.documentElement.removeAttribute('data-dialog-return');
    }
  }, [dialogId]);

  const cancelReturn = useCallback((): void => {
    const transition = transitionRef.current;
    transitionRef.current = null;
    pendingCompletionRef.current = false;
    transition?.skipTransition();
    clearMarker();
  }, [clearMarker]);

  useLayoutEffect(() => {
    requestedOpenRef.current = open;
    completionRef.current = onOpenChangeComplete;
  }, [onOpenChangeComplete, open]);

  useLayoutEffect(() => cancelReturn, [cancelReturn]);

  useLayoutEffect(() => {
    if (open) {
      cancelReturn();
      skipReturnRef.current = false;
      setRetainedOpen(true);

      return;
    }

    if (!retainedOpen || transitionRef.current !== null) {
      return;
    }

    const popup = document.querySelector<HTMLElement>(`[data-dialog-motion-id="${dialogId}"]`);
    if (
      skipReturnRef.current ||
      popup === null ||
      popup.dataset['size'] === 'small' ||
      !window.matchMedia?.('(max-width: 639px)').matches ||
      prefersReducedMotion() ||
      typeof document.startViewTransition !== 'function'
    ) {
      setRetainedOpen(false);

      return;
    }

    document.documentElement.setAttribute('data-dialog-return', dialogId);
    let transition: ViewTransition;

    try {
      transition = document.startViewTransition(() => {
        // a skipped capture can run late; never unmount a replacement or an unmounted root.
        if (requestedOpenRef.current || transitionRef.current !== transition) {
          return;
        }

        flushSync(() => setRetainedOpen(false));
        // Base UI must commit closed before its imperative unmount restores focus.
        flushSync(() => actionsRef.current?.unmount());
      });
    } catch {
      // snapshot setup is optional and must never prevent dismissal.
      clearMarker();
      setRetainedOpen(false);

      return;
    }

    transitionRef.current = transition;

    /**
     * Releases snapshot styling and reports completion only for the current close.
     * @returns A promise that resolves after both native snapshot stages settle.
     */
    const finishReturn = async (): Promise<void> => {
      // skipped or unavailable snapshots may reject while still running the DOM update.
      await Promise.allSettled([transition.ready, transition.finished]);

      if (transitionRef.current !== transition) {
        return;
      }

      transitionRef.current = null;
      clearMarker();
      if (pendingCompletionRef.current) {
        pendingCompletionRef.current = false;
        completionRef.current(false);
      }
    };

    void finishReturn();
  }, [actionsRef, cancelReturn, clearMarker, dialogId, open, retainedOpen]);

  const completeOpenChange = useCallback((isOpen: boolean): void => {
    if (!isOpen && transitionRef.current !== null) {
      pendingCompletionRef.current = true;
    } else {
      completionRef.current(isOpen);
    }
  }, []);

  const skipReturn = useCallback((): void => {
    skipReturnRef.current = true;
    cancelReturn();
    setRetainedOpen(false);
  }, [cancelReturn]);

  return { dialogId, renderedOpen: open || retainedOpen, completeOpenChange, skipReturn };
};
