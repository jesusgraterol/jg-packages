import { useCallback, useLayoutEffect, useRef } from 'react';
import type { Dialog as BaseDialog } from '@base-ui/react/dialog';

import { useDialogNavigationDismissal } from '../../components/dialog-navigation/index.js';

import type { IDialogNavigationRootOptions } from './types.js';

/**
 * Shares committed open-state tracking and imperative cancellation between dialog primitives.
 * @param options The primitive's controlled state, handle, action ref, and optional session owner.
 * @returns The action ref, uncontrolled-change recorder, and navigation-dismissal predicate.
 */
export const useDialogNavigationRoot = ({
  actionsRef: providedActionsRef,
  defaultOpen = false,
  getNavigationSession,
  handle,
  open,
}: IDialogNavigationRootOptions) => {
  const internalActionsRef = useRef<BaseDialog.Root.Actions | null>(null);
  const actionsRef = providedActionsRef ?? internalActionsRef;
  const session = useRef<object | null>(null);
  const isOpen = useRef(false);
  const isNavigationDismissal = useRef(false);
  const initialOpen = useRef(open ?? (handle?.isOpen || defaultOpen));

  const updateSession = useCallback((nextOpen: boolean): void => {
    if (nextOpen && !isOpen.current) {
      session.current = {};
    } else if (!nextOpen) {
      session.current = null;
    }

    isOpen.current = nextOpen;
  }, []);
  const recordOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (open === undefined) {
        updateSession(nextOpen);
      }
    },
    [open, updateSession],
  );

  // seed default, controlled, and already-open handle state without emitting a change callback
  useLayoutEffect(() => {
    updateSession(initialOpen.current);
  }, [updateSession]);

  useLayoutEffect(() => {
    if (open !== undefined) {
      updateSession(open);
    } else if (handle !== undefined) {
      updateSession(handle.isOpen);
    }
  }, [handle, open, updateSession]);

  useDialogNavigationDismissal({
    getSession: () => {
      if (getNavigationSession !== undefined) {
        return getNavigationSession();
      }

      return handle !== undefined && !handle.isOpen ? null : session.current;
    },
    onDismiss: () => {
      isNavigationDismissal.current = true;

      try {
        actionsRef.current?.close();
      } finally {
        isNavigationDismissal.current = false;
      }
    },
  });

  const isDismissingForNavigation = useCallback(() => isNavigationDismissal.current, []);

  return { actionsRef, recordOpenChange, isDismissingForNavigation };
};
