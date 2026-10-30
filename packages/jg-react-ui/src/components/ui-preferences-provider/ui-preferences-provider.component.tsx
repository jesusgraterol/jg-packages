import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type * as React from 'react';

import { getUiPreferencesStorageKey, UI_PREFERENCES_STORE_ID } from '../../contracts/index.js';

import {
  createUiPreferencesStore,
  UiPreferencesStoreContext,
  areUiPreferencesEqual,
  normalizeUiPreferences,
  readStoredUiPreferences,
  writeStoredUiPreferences,
} from '../../shared/ui-preferences/index.js';
import { useErrorFeedbackResolver } from '../error-feedback-provider/index.js';
import { toastr } from '../toastr/index.js';
import type {
  IUiPreferencesCapabilities,
  IUiPreferencesProviderProps,
  IUiPreferencesSuccessNotification,
} from './types.js';
import { UiPreferencesCapabilitiesContext } from './ui-preferences.context.js';

/**
 * Owns UI preference capability, optimistic state, persistence ordering, and rollback behavior.
 * @param props The explicit persistence mode, initial preference snapshot, adapter, and children.
 * @returns A provider containing the shared UI preference lifecycle.
 * @example
 * import { createElement } from 'react';
 * import { UiPreferencesProvider } from 'jg-react-ui/components/ui-preferences-provider';
 * const app = createElement(UiPreferencesProvider, { mode: 'local', storageId: 'personal-hq', children: 'App' });
 * @throws
 * - UI_PREFERENCES_STORAGE_ID_INVALID: UI preferences storage ID must be a non-empty string containing only letters, digits, underscores, and hyphens.
 */
export const UiPreferencesProvider = (props: IUiPreferencesProviderProps): React.ReactElement => {
  const [storageId] = useState(() => {
    const namespace = props.storageId === undefined ? UI_PREFERENCES_STORE_ID : props.storageId;
    getUiPreferencesStorageKey(namespace);
    return namespace;
  });
  const storageKey = getUiPreferencesStorageKey(storageId);
  const [store] = useState(() => createUiPreferencesStore(props.initialPreferences));
  const setUiPreferences = store.getState().setUiPreferences;
  const initialSnapshot = store.getInitialState().uiPreferences;
  const resolveErrorFeedback = useErrorFeedbackResolver();
  const resolveErrorFeedbackRef = useRef(resolveErrorFeedback);
  const [isPreferencesUpdatePending, setIsPreferencesUpdatePending] = useState(false);
  const isMountedRef = useRef(false);
  const modeRef = useRef(props.mode);
  const persistPreferencesRef = useRef(
    props.mode === 'remote' ? props.persistPreferences : undefined,
  );
  const initialPreferencesRef = useRef(props.initialPreferences);
  const confirmedPreferencesRef = useRef(initialSnapshot);
  const desiredPreferencesRef = useRef(initialSnapshot);
  const desiredRevisionRef = useRef(0);
  const pendingSuccessNotificationRef = useRef<{
    notification: IUiPreferencesSuccessNotification;
    revision: number;
  } | null>(null);
  const isProcessingRemoteQueueRef = useRef(false);
  const shouldSynchronizeAfterRemoteQueueRef = useRef(false);

  useLayoutEffect(() => {
    modeRef.current = props.mode;
    persistPreferencesRef.current = props.mode === 'remote' ? props.persistPreferences : undefined;
    initialPreferencesRef.current = props.initialPreferences;
    resolveErrorFeedbackRef.current = resolveErrorFeedback;
  });

  useLayoutEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Synchronizes provider state from the latest authoritative props or local storage.
   */
  const synchronizePreferences = useCallback((): void => {
    const nextPreferences = normalizeUiPreferences(
      initialPreferencesRef.current ?? readStoredUiPreferences(storageId),
    );

    confirmedPreferencesRef.current = nextPreferences;
    desiredPreferencesRef.current = nextPreferences;
    pendingSuccessNotificationRef.current = null;
    setUiPreferences(nextPreferences);

    if (modeRef.current === 'local') {
      writeStoredUiPreferences(nextPreferences, storageId);
    }
  }, [setUiPreferences, storageId]);

  useLayoutEffect(() => {
    if (isProcessingRemoteQueueRef.current) {
      if (props.mode !== 'remote') {
        shouldSynchronizeAfterRemoteQueueRef.current = true;
      }

      return;
    }

    synchronizePreferences();
  }, [props.initialPreferences, props.mode, synchronizePreferences]);

  useEffect(() => {
    /**
     * Synchronizes confirmed preferences after another browser tab commits a change.
     * @param event The browser storage event carrying the shared preference namespace.
     */
    const handleStorageChange = (event: StorageEvent): void => {
      if (
        modeRef.current !== 'local' ||
        event.key !== storageKey ||
        isProcessingRemoteQueueRef.current
      ) {
        return;
      }

      const nextPreferences = readStoredUiPreferences(storageId);

      confirmedPreferencesRef.current = nextPreferences;
      desiredPreferencesRef.current = nextPreferences;
      setUiPreferences(nextPreferences);
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [setUiPreferences, storageId, storageKey]);

  /**
   * Persists desired remote snapshots sequentially and rolls back the latest failed batch.
   * @returns A promise that resolves when no newer desired preference snapshot remains.
   */
  const processRemoteQueue = useCallback(async (): Promise<void> => {
    if (isProcessingRemoteQueueRef.current || modeRef.current !== 'remote') {
      return;
    }

    isProcessingRemoteQueueRef.current = true;

    if (isMountedRef.current) {
      setIsPreferencesUpdatePending(true);
    }

    try {
      while (
        modeRef.current === 'remote' &&
        !areUiPreferencesEqual(desiredPreferencesRef.current, confirmedPreferencesRef.current)
      ) {
        const submittedPreferences = desiredPreferencesRef.current;
        const submittedRevision = desiredRevisionRef.current;
        const persistPreferences = persistPreferencesRef.current;

        if (!persistPreferences) {
          break;
        }

        try {
          await persistPreferences(submittedPreferences);

          if (!isMountedRef.current || modeRef.current !== 'remote') {
            shouldSynchronizeAfterRemoteQueueRef.current = true;
            break;
          }

          confirmedPreferencesRef.current = submittedPreferences;
          writeStoredUiPreferences(submittedPreferences, storageId);

          const pendingSuccessNotification = pendingSuccessNotificationRef.current;
          if (
            submittedRevision === desiredRevisionRef.current &&
            pendingSuccessNotification?.revision === submittedRevision
          ) {
            toastr.success(pendingSuccessNotification.notification.title, {
              description: pendingSuccessNotification.notification.description,
            });
            pendingSuccessNotificationRef.current = null;
          }
        } catch (error) {
          if (!isMountedRef.current || modeRef.current !== 'remote') {
            shouldSynchronizeAfterRemoteQueueRef.current = true;
            break;
          }

          const rollbackPreferences = normalizeUiPreferences(
            initialPreferencesRef.current,
            confirmedPreferencesRef.current,
          );

          confirmedPreferencesRef.current = rollbackPreferences;
          desiredPreferencesRef.current = rollbackPreferences;
          pendingSuccessNotificationRef.current = null;
          setUiPreferences(rollbackPreferences);
          writeStoredUiPreferences(rollbackPreferences, storageId);
          const feedback = resolveErrorFeedbackRef.current(error, {
            fallbackMessage: 'We could not save your preferences. Please try again.',
          });
          if (!feedback.isCancelled) {
            toastr.error('Preference update failed', { description: feedback.message });
          }
          break;
        }
      }
    } finally {
      isProcessingRemoteQueueRef.current = false;

      if (isMountedRef.current) {
        if (shouldSynchronizeAfterRemoteQueueRef.current) {
          shouldSynchronizeAfterRemoteQueueRef.current = false;
          synchronizePreferences();
        }

        setIsPreferencesUpdatePending(false);
      }
    }
  }, [setUiPreferences, storageId, synchronizePreferences]);

  /**
   * Applies an optimistic preference patch according to the active provider mode.
   * @param uiPreferencesPatch The preference fields to update.
   */
  const updatePreferences = useCallback<IUiPreferencesCapabilities['updatePreferences']>(
    (uiPreferencesPatch, options): void => {
      if (modeRef.current === 'read-only') {
        return;
      }

      const currentPreferences = desiredPreferencesRef.current;
      const nextPreferences = normalizeUiPreferences(
        {
          ...currentPreferences,
          ...uiPreferencesPatch,
        },
        currentPreferences,
      );

      if (areUiPreferencesEqual(currentPreferences, nextPreferences)) {
        return;
      }

      desiredPreferencesRef.current = nextPreferences;
      desiredRevisionRef.current += 1;
      pendingSuccessNotificationRef.current = options?.successNotification
        ? {
            notification: options.successNotification,
            revision: desiredRevisionRef.current,
          }
        : null;
      setUiPreferences(nextPreferences);

      if (modeRef.current === 'local') {
        confirmedPreferencesRef.current = nextPreferences;
        writeStoredUiPreferences(nextPreferences, storageId);
        return;
      }

      void processRemoteQueue();
    },
    [processRemoteQueue, setUiPreferences],
  );

  const contextValue = useMemo<IUiPreferencesCapabilities>(
    () => ({
      canUpdatePreferences: props.mode !== 'read-only',
      isPreferencesUpdatePending,
      updatePreferences,
    }),
    [isPreferencesUpdatePending, props.mode, updatePreferences],
  );

  return (
    <UiPreferencesStoreContext value={store}>
      <UiPreferencesCapabilitiesContext value={contextValue}>
        {props.children}
      </UiPreferencesCapabilitiesContext>
    </UiPreferencesStoreContext>
  );
};
