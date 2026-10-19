import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';

import { generateUuid } from 'jg-utilities';

import { DEFAULT_FILE_UPLOAD_MESSAGES } from './constants.js';
import { resolveFileUploadPolicy } from './transformers.js';
import type {
  IFileUploadAction,
  IFileUploadErrorFeedback,
  IFileUploadFailedItem,
  IFileUploadItem,
  IFileUploadMessages,
  IFileUploadPolicy,
  IFileUploadRejectedItem,
  IFileUploadSucceededItem,
  IUseFileUploadQueueOptions,
  IUseFileUploadQueueResult,
} from './types.js';
import {
  createCanceledFileUploadItem,
  createCustomFileUploadValidationIssue,
  createFileUploadErrorDetails,
  createFileUploadSummary,
  createValidatingFileUploadItem,
  fileUploadReducer,
  getCandidateAdmissionFiles,
  invokeCallback,
  isFileUploadItemCancelable,
  reportUnexpectedError,
} from './utilities.js';
import { validateFileUploadCandidate } from './validations.js';

// an upload attempt that's running, until its promise settles
type IActiveUpload = {
  attemptNumber: number;
  controller: AbortController;
};

// the latest progress report of an attempt, waiting for the next frame
type IPendingProgress = {
  attemptNumber: number;
  frameId: number;
  totalBytes: number;
  uploadedBytes: number;
};

// the options callbacks read when they run, rather than when they were created
type ILatestOptions<TResult> = Pick<
  IUseFileUploadQueueOptions<TResult>,
  | 'onFileRejected'
  | 'onItemsChange'
  | 'onUploadCanceled'
  | 'onUploadFailure'
  | 'onUploadSuccess'
  | 'uploadFile'
  | 'validateFile'
> & {
  existingFiles: readonly File[];
  getErrorFeedback: (error: unknown) => IFileUploadErrorFeedback;
  isDisabled: boolean;
  isPreviewEnabled: boolean;
  messages: IFileUploadMessages;
  policy: IFileUploadPolicy;
};

// no files, so a default never changes from render to render
const NO_FILES: readonly File[] = [];

/**
 * Creates a preview's object URL, when previews are on.
 * @param file The file.
 * @param isPreviewEnabled Whether previews are on.
 * @returns The URL, or null.
 */
const createPreviewUrl = (file: File, isPreviewEnabled: boolean): string | null =>
  isPreviewEnabled ? URL.createObjectURL(file) : null;

/**
 * Runs a headless file upload queue, for a drop zone or a file input in the app's own markup.
 * Selections are checked one at a time, against the built-in checks, then `validateFile`, then
 * the built-in checks again, since the queue may have changed meanwhile. Admitted files upload
 * first in, first out, up to `maxConcurrentUploads` at once, with progress coalesced per frame.
 * At 100%, an upload is processing: it can't be canceled anymore, and it survives removal and
 * reset. A canceled upload is aborted and its late result ignored, but its slot frees only once
 * its promise settles. A retry keeps the item's id. With `maxFiles` 1, a new file replaces the
 * current one only once it validates. Object URLs are revoked on remove, replace, reset, and
 * unmount, and errors the callbacks throw go to `reportError`. Shown again after an `<Activity>`
 * hid it, items whose work stopped are canceled.
 * @param options The policy, the upload and validation functions, the messages, and the callbacks.
 * @returns The controls, which keep their identity, the items, their summary, the latest
 * announcement for a polite live region, and the policy.
 * @example
 * import { useFileUploadQueue } from 'jg-react';
 *
 * declare const uploadAvatar: (file: File, signal: AbortSignal) => Promise<{ url: string }>;
 *
 * export const useAvatarUpload = () =>
 *   useFileUploadQueue({
 *     acceptedFileTypes: ['image/png', 'image/jpeg'],
 *     maxFileBytes: 5 * 1024 * 1024,
 *     isPreviewEnabled: true,
 *     uploadFile: (file, { signal }) => uploadAvatar(file, signal),
 *   });
 * @throws
 * - INVALID_FILE_UPLOAD_POLICY: The accepted file types must be an array.
 * - INVALID_FILE_UPLOAD_POLICY: Each accepted file type must be a string.
 * - INVALID_FILE_UPLOAD_POLICY: Each accepted file type must be a file extension, such as .png, or a MIME type, such as image/png.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum file size must be a positive integer of bytes.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum file count must be a positive integer.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum concurrent uploads must be a positive integer.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum total size must be a positive integer of bytes, when given.
 */
export const useFileUploadQueue = <TResult>({
  acceptedFileTypes,
  allowDuplicateFiles,
  autoUpload,
  maxConcurrentUploads,
  maxFileBytes,
  maxFiles,
  maxTotalBytes,
  replaceSingleFile,
  uploadFile,
  validateFile,
  disabled = false,
  existingFiles = NO_FILES,
  isPreviewEnabled = false,
  messages,
  getErrorFeedback,
  controlsRef,
  onItemsChange,
  onFileRejected,
  onUploadSuccess,
  onUploadFailure,
  onUploadCanceled,
}: IUseFileUploadQueueOptions<TResult>): IUseFileUploadQueueResult<TResult> => {
  // the accepted types' contents, so an inline array doesn't build a new policy every render
  const acceptedFileTypesKey = JSON.stringify(acceptedFileTypes);
  const policy = useMemo(
    () =>
      resolveFileUploadPolicy({
        acceptedFileTypes,
        allowDuplicateFiles,
        autoUpload,
        maxConcurrentUploads,
        maxFileBytes,
        maxFiles,
        maxTotalBytes,
        replaceSingleFile,
      }),
    // the key stands for acceptedFileTypes: the same key always means the same types
    [
      acceptedFileTypesKey,
      allowDuplicateFiles,
      autoUpload,
      maxConcurrentUploads,
      maxFileBytes,
      maxFiles,
      maxTotalBytes,
      replaceSingleFile,
    ],
  );
  const resolvedMessages = useMemo(
    () => ({ ...DEFAULT_FILE_UPLOAD_MESSAGES, ...messages }),
    [messages],
  );
  const latestOptions: ILatestOptions<TResult> = {
    existingFiles,
    getErrorFeedback:
      getErrorFeedback ?? (() => ({ message: resolvedMessages.uploadFailed, code: null })),
    isDisabled: disabled,
    isPreviewEnabled,
    messages: resolvedMessages,
    onFileRejected,
    onItemsChange,
    onUploadCanceled,
    onUploadFailure,
    onUploadSuccess,
    policy,
    uploadFile,
    validateFile,
  };
  const optionsRef = useRef(latestOptions);
  useLayoutEffect(() => {
    optionsRef.current = latestOptions;
  });

  const [announcement, setAnnouncement] = useState('');
  const [schedulerVersion, setSchedulerVersion] = useState(0);
  const [items, reactDispatch] = useReducer(
    fileUploadReducer<TResult>,
    [] as readonly IFileUploadItem<TResult>[],
  );
  // the items as of the last dispatch, ahead of React's next render
  const itemsRef = useRef(items);
  const activeUploadsRef = useRef(new Map<string, IActiveUpload>());
  const validationControllersRef = useRef(new Map<string, AbortController>());
  const pendingProgressRef = useRef(new Map<string, IPendingProgress>());
  const selectionQueueRef = useRef(Promise.resolve());
  const isManualQueueRunningRef = useRef(false);
  const isMountedRef = useRef(false);
  const lastNotifiedItemsRef = useRef(items);

  const summary = useMemo(() => createFileUploadSummary(items), [items]);

  /**
   * Applies a transition to the items at once, and queues it for React's next render.
   * @param action The transition.
   * @returns The items after it.
   */
  const dispatchAction = useCallback(
    (action: IFileUploadAction<TResult>): readonly IFileUploadItem<TResult>[] => {
      const nextItems = fileUploadReducer(itemsRef.current, action);
      if (nextItems !== itemsRef.current) {
        itemsRef.current = nextItems;
        reactDispatch(action);
      }
      return nextItems;
    },
    [],
  );

  // after unmount, React ignores the update
  const announce = setAnnouncement;

  /**
   * Drops an upload's progress report waiting for a frame.
   * @param uploadId The item's id.
   */
  const cancelPendingProgress = useCallback((uploadId: string): void => {
    const pending = pendingProgressRef.current.get(uploadId);
    if (pending !== undefined) {
      cancelAnimationFrame(pending.frameId);
      pendingProgressRef.current.delete(uploadId);
    }
  }, []);

  /**
   * Applies an upload's latest progress report now, which the queue ignores once the attempt
   * isn't the item's current one.
   * @param uploadId The item's id.
   */
  const flushPendingProgress = useCallback(
    (uploadId: string): void => {
      const pending = pendingProgressRef.current.get(uploadId);
      if (pending === undefined) {
        return;
      }
      cancelPendingProgress(uploadId);
      const { attemptNumber, uploadedBytes, totalBytes } = pending;
      dispatchAction({ type: 'progress', uploadId, attemptNumber, uploadedBytes, totalBytes });
    },
    [cancelPendingProgress, dispatchAction],
  );

  /**
   * Keeps an attempt's latest progress report for the next frame, so a fast transport renders at
   * most once a frame.
   * @param uploadId The item's id.
   * @param attemptNumber The attempt's number.
   * @param uploadedBytes The bytes reported sent.
   * @param totalBytes The total reported.
   */
  const queueProgress = useCallback(
    (uploadId: string, attemptNumber: number, uploadedBytes: number, totalBytes: number): void => {
      const activeUpload = activeUploadsRef.current.get(uploadId);
      if (
        !isMountedRef.current ||
        activeUpload?.attemptNumber !== attemptNumber ||
        activeUpload.controller.signal.aborted
      ) {
        return;
      }
      const pending = pendingProgressRef.current.get(uploadId);
      if (pending !== undefined) {
        pendingProgressRef.current.set(uploadId, { ...pending, totalBytes, uploadedBytes });
        return;
      }
      pendingProgressRef.current.set(uploadId, {
        attemptNumber,
        frameId: requestAnimationFrame(() => {
          flushPendingProgress(uploadId);
        }),
        totalBytes,
        uploadedBytes,
      });
    },
    [flushPendingProgress],
  );

  /**
   * Revokes an item's preview URL, if it has one.
   * @param item The item.
   */
  const releasePreview = useCallback((item: IFileUploadItem<TResult>): void => {
    if (item.previewUrl !== null) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }, []);

  /**
   * Tells the app and the live region that an item was canceled.
   * @param item The item, before it was canceled.
   */
  const notifyCanceled = useCallback(
    (item: IFileUploadItem<TResult>): void => {
      invokeCallback(optionsRef.current.onUploadCanceled, createCanceledFileUploadItem(item));
      announce(optionsRef.current.messages.canceled(item.file.name));
    },
    [announce],
  );

  /**
   * Aborts an item's validation and upload; a running upload keeps its slot until it settles.
   * @param uploadId The item's id.
   */
  const abortFileWork = useCallback(
    (uploadId: string): void => {
      validationControllersRef.current.get(uploadId)?.abort();
      validationControllersRef.current.delete(uploadId);
      activeUploadsRef.current.get(uploadId)?.controller.abort();
      cancelPendingProgress(uploadId);
    },
    [cancelPendingProgress],
  );

  const cancelUpload = useCallback(
    (uploadId: string): void => {
      const item = itemsRef.current.find((current) => current.uploadId === uploadId);
      if (item === undefined || !isFileUploadItemCancelable(item)) {
        return;
      }
      abortFileWork(uploadId);
      dispatchAction({ type: 'cancel', uploadId });
      notifyCanceled(item);
    },
    [abortFileWork, dispatchAction, notifyCanceled],
  );

  const cancelAllUploads = useCallback((): void => {
    for (const item of itemsRef.current) {
      if (isFileUploadItemCancelable(item)) {
        abortFileWork(item.uploadId);
        dispatchAction({ type: 'cancel', uploadId: item.uploadId });
        notifyCanceled(item);
      }
    }
  }, [abortFileWork, dispatchAction, notifyCanceled]);

  const removeFile = useCallback(
    (uploadId: string): void => {
      const item = itemsRef.current.find((current) => current.uploadId === uploadId);
      if (item === undefined || item.status === 'processing') {
        return;
      }
      if (isFileUploadItemCancelable(item)) {
        abortFileWork(uploadId);
        notifyCanceled(item);
      }
      releasePreview(item);
      dispatchAction({ type: 'remove', uploadId });
    },
    [abortFileWork, dispatchAction, notifyCanceled, releasePreview],
  );

  const reset = useCallback((): void => {
    const hasProcessingItems = itemsRef.current.some((item) => item.status === 'processing');
    for (const item of itemsRef.current) {
      if (isFileUploadItemCancelable(item)) {
        abortFileWork(item.uploadId);
        notifyCanceled(item);
      }
      if (item.status !== 'processing') {
        releasePreview(item);
      }
    }
    isManualQueueRunningRef.current = false;
    dispatchAction({ type: 'reset' });
    const { messages: currentMessages } = optionsRef.current;
    announce(
      hasProcessingItems
        ? currentMessages.queueClearedWhileProcessing
        : currentMessages.queueCleared,
    );
  }, [abortFileWork, announce, dispatchAction, notifyCanceled, releasePreview]);

  const retryUpload = useCallback(
    (uploadId: string): void => {
      if (optionsRef.current.isDisabled) {
        return;
      }
      const item = itemsRef.current.find((current) => current.uploadId === uploadId);
      if (item === undefined || (item.status !== 'failed' && item.status !== 'canceled')) {
        return;
      }
      dispatchAction({ type: 'retry', uploadId });
      announce(optionsRef.current.messages.queuedForRetry(item.file.name));
    },
    [announce, dispatchAction],
  );

  const startUploads = useCallback((): void => {
    if (optionsRef.current.isDisabled) {
      return;
    }
    isManualQueueRunningRef.current = true;
    setSchedulerVersion((version) => version + 1);
  }, []);

  /**
   * Queues a file that passed every check, with its preview.
   * @param uploadId The item's id.
   * @param file The file.
   */
  const queueValidatedFile = useCallback(
    (uploadId: string, file: File): void => {
      dispatchAction({
        type: 'queue',
        uploadId,
        previewUrl: createPreviewUrl(file, optionsRef.current.isPreviewEnabled),
      });
      announce(optionsRef.current.messages.queued(file.name));
    },
    [announce, dispatchAction],
  );

  /**
   * Rejects an item, and tells the app and the live region why.
   * @param uploadId The item's id.
   * @param issue Why it was rejected.
   */
  const rejectFile = useCallback(
    (uploadId: string, issue: IFileUploadRejectedItem['validationIssue']): void => {
      dispatchAction({ type: 'reject', uploadId, issue })
        .filter(
          (item): item is IFileUploadRejectedItem =>
            item.uploadId === uploadId && item.status === 'rejected',
        )
        .forEach((rejectedItem) => {
          invokeCallback(optionsRef.current.onFileRejected, rejectedItem);
          announce(optionsRef.current.messages.fileIssue(rejectedItem.file.name, issue.message));
        });
    },
    [announce, dispatchAction],
  );

  /**
   * Removes every item but the selection's and the processing ones, once a single file's
   * replacement passed its checks.
   * @param candidateUploadIds The selection's items.
   */
  const replaceCurrentFile = useCallback(
    (candidateUploadIds: ReadonlySet<string>): void => {
      for (const item of itemsRef.current) {
        if (candidateUploadIds.has(item.uploadId) || item.status === 'processing') {
          continue;
        }
        if (isFileUploadItemCancelable(item)) {
          abortFileWork(item.uploadId);
          notifyCanceled(item);
        }
        releasePreview(item);
        dispatchAction({ type: 'remove', uploadId: item.uploadId });
      }
    },
    [abortFileWork, dispatchAction, notifyCanceled, releasePreview],
  );

  /**
   * Checks one selection's files in order, and queues or rejects each.
   * @param files The selection.
   * @returns A promise that resolves once every file is queued or rejected.
   */
  const processSelection = useCallback(
    async (files: readonly File[]): Promise<void> => {
      const selectionPolicy = optionsRef.current.policy;
      const validatingItems = files.map((file) =>
        createValidatingFileUploadItem(file, generateUuid(4)),
      );
      const candidateUploadIds = new Set(validatingItems.map(({ uploadId }) => uploadId));
      let hasAdmittedReplacement = false;
      const readAdmittedFiles = (): File[] =>
        getCandidateAdmissionFiles(
          optionsRef.current.existingFiles,
          itemsRef.current,
          candidateUploadIds,
          selectionPolicy,
          hasAdmittedReplacement,
        );
      dispatchAction({ type: 'add-validating', items: validatingItems });

      for (const { uploadId, file } of validatingItems) {
        if (!isMountedRef.current) {
          return;
        }
        if (itemsRef.current.find((item) => item.uploadId === uploadId)?.status !== 'validating') {
          continue;
        }
        const admittedFiles = readAdmittedFiles();
        const { messages: currentMessages } = optionsRef.current;
        const builtInIssue = validateFileUploadCandidate(
          file,
          admittedFiles,
          selectionPolicy,
          currentMessages,
        );
        if (builtInIssue !== null) {
          rejectFile(uploadId, builtInIssue);
          continue;
        }
        const { validateFile: validate } = optionsRef.current;
        if (validate !== undefined) {
          const controller = new AbortController();
          validationControllersRef.current.set(uploadId, controller);
          try {
            const customIssue = await validate(file, {
              admittedFiles,
              signal: controller.signal,
              uploadId,
            });
            if (
              controller.signal.aborted ||
              itemsRef.current.find((item) => item.uploadId === uploadId)?.status !== 'validating'
            ) {
              continue;
            }
            if (customIssue !== null) {
              rejectFile(uploadId, customIssue);
              continue;
            }
          } catch (error) {
            if (!controller.signal.aborted) {
              rejectFile(
                uploadId,
                createCustomFileUploadValidationIssue(error, optionsRef.current.getErrorFeedback),
              );
            }
            continue;
          } finally {
            validationControllersRef.current.delete(uploadId);
          }
          // the queue may have changed while the validator ran
          const refreshedIssue = validateFileUploadCandidate(
            file,
            readAdmittedFiles(),
            selectionPolicy,
            optionsRef.current.messages,
          );
          if (refreshedIssue !== null) {
            rejectFile(uploadId, refreshedIssue);
            continue;
          }
        }
        if (selectionPolicy.replaceSingleFile) {
          replaceCurrentFile(candidateUploadIds);
          hasAdmittedReplacement = true;
        }
        queueValidatedFile(uploadId, file);
      }
    },
    [dispatchAction, queueValidatedFile, rejectFile, replaceCurrentFile],
  );

  const addFiles = useCallback(
    (files: Iterable<File>): void => {
      if (optionsRef.current.isDisabled) {
        return;
      }
      const selectedFiles = Array.from(files);
      if (selectedFiles.length === 0) {
        return;
      }
      // one selection at a time, so each is checked against the files the earlier ones admitted
      selectionQueueRef.current = selectionQueueRef.current
        .then(() => processSelection(selectedFiles))
        .catch(reportUnexpectedError);
    },
    [processSelection],
  );

  /**
   * Runs one upload attempt, publishes its outcome unless it was aborted, and frees its slot once
   * it settles.
   * @param item The queued item.
   * @param attemptNumber The attempt's number.
   * @param controller The attempt's abort controller.
   * @returns A promise that resolves once the attempt settled.
   */
  const runUpload = useCallback(
    async (
      item: IFileUploadItem<TResult>,
      attemptNumber: number,
      controller: AbortController,
    ): Promise<void> => {
      const isCurrentAttempt = (): boolean =>
        isMountedRef.current &&
        !controller.signal.aborted &&
        activeUploadsRef.current.get(item.uploadId)?.attemptNumber === attemptNumber;
      try {
        const result = await optionsRef.current.uploadFile(item.file, {
          attemptNumber,
          reportProgress: (uploadedBytes, totalBytes) => {
            queueProgress(item.uploadId, attemptNumber, uploadedBytes, totalBytes);
          },
          signal: controller.signal,
          uploadId: item.uploadId,
        });
        flushPendingProgress(item.uploadId);
        if (!isCurrentAttempt()) {
          return;
        }
        dispatchAction({ type: 'succeed', uploadId: item.uploadId, attemptNumber, result })
          .filter(
            (current): current is IFileUploadSucceededItem<TResult> =>
              current.uploadId === item.uploadId && current.status === 'succeeded',
          )
          .forEach((succeededItem) => {
            invokeCallback(optionsRef.current.onUploadSuccess, succeededItem);
            announce(optionsRef.current.messages.uploadComplete(item.file.name));
          });
      } catch (error) {
        flushPendingProgress(item.uploadId);
        if (!isCurrentAttempt()) {
          return;
        }
        const errorDetails = createFileUploadErrorDetails(
          error,
          optionsRef.current.getErrorFeedback,
        );
        dispatchAction({
          type: 'fail',
          uploadId: item.uploadId,
          attemptNumber,
          error: errorDetails,
        })
          .filter(
            (current): current is IFileUploadFailedItem =>
              current.uploadId === item.uploadId && current.status === 'failed',
          )
          .forEach((failedItem) => {
            invokeCallback(optionsRef.current.onUploadFailure, failedItem);
            announce(optionsRef.current.messages.fileIssue(item.file.name, errorDetails.message));
          });
      } finally {
        if (activeUploadsRef.current.get(item.uploadId)?.attemptNumber === attemptNumber) {
          activeUploadsRef.current.delete(item.uploadId);
        }
        cancelPendingProgress(item.uploadId);
        // frees the slot, which React ignores after unmount
        setSchedulerVersion((version) => version + 1);
      }
    },
    [announce, cancelPendingProgress, dispatchAction, flushPendingProgress, queueProgress],
  );

  // declared before the scheduler, so a queue shown again is restored before anything starts
  useEffect(() => {
    isMountedRef.current = true;
    const activeUploads = activeUploadsRef.current;
    const validationControllers = validationControllersRef.current;
    const pendingProgress = pendingProgressRef.current;
    // shown again after its effects were torn down, as by an <Activity>: the work that stopped is
    // canceled, and the revoked previews get new URLs
    const interruptedItems = itemsRef.current.filter(
      (item) =>
        item.status === 'validating' || item.status === 'uploading' || item.status === 'processing',
    );
    const previewUrls = new Map(
      itemsRef.current
        .filter((item) => item.previewUrl !== null)
        .map((item) => [
          item.uploadId,
          createPreviewUrl(item.file, optionsRef.current.isPreviewEnabled),
        ]),
    );
    if (interruptedItems.length > 0 || previewUrls.size > 0) {
      dispatchAction({
        type: 'restore',
        interruptedIds: new Set(interruptedItems.map(({ uploadId }) => uploadId)),
        previewUrls,
      });
      interruptedItems.forEach(notifyCanceled);
    }
    return () => {
      isMountedRef.current = false;
      validationControllers.forEach((controller) => {
        controller.abort();
      });
      activeUploads.forEach(({ controller }) => {
        controller.abort();
      });
      pendingProgress.forEach(({ frameId }) => {
        cancelAnimationFrame(frameId);
      });
      itemsRef.current.forEach(releasePreview);
      activeUploads.clear();
      validationControllers.clear();
      pendingProgress.clear();
    };
  }, [dispatchAction, notifyCanceled, releasePreview]);

  // starts queued uploads, first in, first out, while slots are free
  useEffect(() => {
    if (disabled || (!policy.autoUpload && !isManualQueueRunningRef.current)) {
      return;
    }
    const availableSlots = policy.maxConcurrentUploads - activeUploadsRef.current.size;
    if (availableSlots > 0) {
      const queuedItems = itemsRef.current
        .filter((item) => item.status === 'queued' && !activeUploadsRef.current.has(item.uploadId))
        .slice(0, availableSlots);
      for (const item of queuedItems) {
        const attemptNumber = item.attemptNumber + 1;
        const controller = new AbortController();
        activeUploadsRef.current.set(item.uploadId, { attemptNumber, controller });
        dispatchAction({ type: 'start', uploadId: item.uploadId, attemptNumber });
        announce(optionsRef.current.messages.uploadStarted(item.file.name));
        void runUpload(item, attemptNumber, controller);
      }
    }
    if (
      !policy.autoUpload &&
      activeUploadsRef.current.size === 0 &&
      itemsRef.current.every((item) => item.status !== 'queued' && item.status !== 'validating')
    ) {
      isManualQueueRunningRef.current = false;
    }
  }, [
    announce,
    disabled,
    dispatchAction,
    items,
    policy.autoUpload,
    policy.maxConcurrentUploads,
    runUpload,
    schedulerVersion,
  ]);

  // tells the app about each new list of items, once
  useEffect(() => {
    if (lastNotifiedItemsRef.current === items) {
      return;
    }
    lastNotifiedItemsRef.current = items;
    invokeCallback(optionsRef.current.onItemsChange, items, summary);
  }, [items, summary]);

  const controls = useMemo(
    () => ({
      addFiles,
      cancelAllUploads,
      cancelUpload,
      removeFile,
      reset,
      retryUpload,
      startUploads,
    }),
    [addFiles, cancelAllUploads, cancelUpload, removeFile, reset, retryUpload, startUploads],
  );
  useImperativeHandle(controlsRef, () => controls, [controls]);

  return useMemo(
    () => ({ ...controls, announcement, items, policy, summary }),
    [announcement, controls, items, policy, summary],
  );
};
