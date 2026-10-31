import {
  type ReactElement,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import {
  resolveFileUploadPolicy,
  type IFileUploadControls,
  type IFileUploadItem,
  type IFileUploadItemsChangeHandler,
  type IFileUploadSucceededItem,
} from 'jg-react';

import { useErrorFeedbackResolver } from '../../error-feedback-provider/index.js';

import { Button } from '../../button/index.js';
import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../dialog/index.js';
import { FileUpload } from '../file-upload.component.js';
import { createFileUploadErrorDetails, createFileUploadPolicyDescription } from '../utilities.js';
import type { IFileUploadDialogProps } from './types.js';

/** Checks whether a non-empty queue is ready for application finalization. */
const isFileUploadQueueReady = <TResult,>(
  items: readonly IFileUploadItem<TResult>[],
): items is readonly IFileUploadSucceededItem<TResult>[] =>
  items.length > 0 && items.every((item) => item.status === 'succeeded');

/** Builds a stable fingerprint for one completely uploaded queue state. */
const createSuccessfulQueueFingerprint = <TResult,>(
  items: readonly IFileUploadSucceededItem<TResult>[],
): string => items.map(({ attemptNumber, uploadId }) => `${uploadId}:${attemptNumber}`).join('|');

/** Reports consumer callback failures without blocking dialog cleanup. */
const reportFileUploadDialogCallbackError = (error: unknown): void => {
  if (typeof globalThis.reportError === 'function') {
    globalThis.reportError(error);
    return;
  }

  queueMicrotask(() => {
    throw error;
  });
};

/**
 * Renders an immediate-upload queue and finalizes its successful results through the owning app.
 * Explicitly reopening selection requires manual submission for the rest of the session.
 * @param props The dialog state, upload policy, finalization callbacks, and optional trigger.
 * @returns A responsive upload dialog with automatic and recoverable manual finalization.
 * @throws
 * - INVALID_FILE_UPLOAD_POLICY: The accepted file types must be an array.
 * - INVALID_FILE_UPLOAD_POLICY: Each accepted file type must be a string.
 * - INVALID_FILE_UPLOAD_POLICY: Each accepted file type must be a file extension, such as .png, or a MIME type, such as image/png.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum file size must be a positive integer of bytes.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum file count must be a positive integer.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum concurrent uploads must be a positive integer.
 * - INVALID_FILE_UPLOAD_POLICY: The maximum total size must be a positive integer of bytes, when given.
 * @example
 * import { createElement } from 'react';
 * import { FileUploadDialog, type IFileUploadProps, type IFileUploadDialogSubmitHandler } from 'jg-react-ui/components/file-upload';
 * declare const uploadFile: IFileUploadProps<string>['uploadFile'];
 * declare const onSubmit: IFileUploadDialogSubmitHandler<string>;
 * const example = createElement(FileUploadDialog<string>, { fileUploadProps: { acceptedFileTypes: ['text/plain'], maxFileBytes: 4096, uploadFile }, onSubmit });
 */
export const FileUploadDialog = <TResult,>({
  closeLabel = 'Close',
  defaultOpen = false,
  fileUploadProps,
  isDismissalDisabled = false,
  onDiscard,
  onOpenChange,
  onOpenChangeComplete,
  onSubmit,
  open: externalOpen,
  size = 'medium',
  submitLabel = 'Submit',
  title = 'Upload files',
  trigger,
  ...dialogProps
}: IFileUploadDialogProps<TResult>): ReactElement => {
  const resolveErrorFeedback = useErrorFeedbackResolver();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [items, setItems] = useState<readonly IFileUploadItem<TResult>[]>([]);
  const [isManualSubmissionRequired, setIsManualSubmissionRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const resolvedOpen = externalOpen ?? internalOpen;
  const controlsRef = useRef<IFileUploadControls>(null);
  const itemsRef = useRef(items);
  const onDiscardRef = useRef(onDiscard);
  const discardedUploadIdsRef = useRef(new Set<string>());
  const automaticSubmissionFingerprintRef = useRef<string | null>(null);
  const isFinalizedRef = useRef(false);
  const isMountedRef = useRef(true);
  const isOpenRef = useRef(resolvedOpen);
  const isSessionAbandonedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const {
    disabled: isUploadDisabled = false,
    onItemsChange,
    onUploadAreaExpand,
    ...uploadProps
  } = fileUploadProps;
  const policy = useMemo(
    () =>
      resolveFileUploadPolicy({
        acceptedFileTypes: fileUploadProps.acceptedFileTypes,
        allowDuplicateFiles: fileUploadProps.allowDuplicateFiles,
        autoUpload: true,
        maxConcurrentUploads: fileUploadProps.maxConcurrentUploads,
        maxFileBytes: fileUploadProps.maxFileBytes,
        maxFiles: fileUploadProps.maxFiles,
        maxTotalBytes: fileUploadProps.maxTotalBytes,
        replaceSingleFile: fileUploadProps.replaceSingleFile,
      }),
    [
      fileUploadProps.acceptedFileTypes,
      fileUploadProps.allowDuplicateFiles,
      fileUploadProps.maxConcurrentUploads,
      fileUploadProps.maxFileBytes,
      fileUploadProps.maxFiles,
      fileUploadProps.maxTotalBytes,
      fileUploadProps.replaceSingleFile,
    ],
  );
  const policyDescription = useMemo(() => createFileUploadPolicyDescription(policy), [policy]);
  const isQueueReady = isFileUploadQueueReady(items);
  const isQueueBusy = items.some(
    (item) =>
      item.status === 'validating' ||
      item.status === 'queued' ||
      item.status === 'uploading' ||
      item.status === 'processing',
  );

  useLayoutEffect(() => {
    isOpenRef.current = resolvedOpen;
    onDiscardRef.current = onDiscard;
  }, [onDiscard, resolvedOpen]);

  /** Reports successful items once before their local queue records disappear. */
  const reportDiscardedItems = useCallback(
    (discardedItems: readonly IFileUploadSucceededItem<TResult>[]): void => {
      const unreportedItems = discardedItems.filter(
        ({ uploadId }) => !discardedUploadIdsRef.current.has(uploadId),
      );

      if (unreportedItems.length === 0) return;
      unreportedItems.forEach(({ uploadId }) => discardedUploadIdsRef.current.add(uploadId));

      try {
        onDiscardRef.current?.(unreportedItems);
      } catch (error) {
        reportFileUploadDialogCallbackError(error);
      }
    },
    [],
  );

  /** Finalizes one fully uploaded queue through the application-owned submit boundary. */
  const submitSuccessfulItems = useCallback(
    async (successfulItems: readonly IFileUploadSucceededItem<TResult>[]): Promise<void> => {
      if (!isSubmittingRef.current && !isFinalizedRef.current) {
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setSubmissionError(null);

        try {
          await onSubmit(successfulItems);
          isFinalizedRef.current = true;

          if (isMountedRef.current && !isSessionAbandonedRef.current) {
            setInternalOpen(false);
            onOpenChange?.(false);
          }
        } catch (error) {
          if (isSessionAbandonedRef.current) {
            reportDiscardedItems(successfulItems);
          } else if (isMountedRef.current) {
            setIsManualSubmissionRequired(true);

            if (!(error instanceof DOMException && error.name === 'AbortError')) {
              setSubmissionError(
                createFileUploadErrorDetails(
                  error,
                  'We could not finish adding these files. Check their status before trying again.',
                  resolveErrorFeedback,
                ).message,
              );
            }
          }
        } finally {
          isSubmittingRef.current = false;

          if (isMountedRef.current) {
            setIsSubmitting(false);

            if (isSessionAbandonedRef.current && isOpenRef.current) {
              isSessionAbandonedRef.current = false;
              isFinalizedRef.current = false;
            }
          }
        }
      }
    },
    [onOpenChange, onSubmit, reportDiscardedItems, resolveErrorFeedback],
  );

  /** Mirrors queue state, latches manual recovery, and detects successful row removal. */
  const handleItemsChange = useCallback<IFileUploadItemsChangeHandler<TResult>>(
    (nextItems, summary) => {
      if (!isFinalizedRef.current) {
        const nextUploadIds = new Set(nextItems.map(({ uploadId }) => uploadId));
        const removedSuccessfulItems = itemsRef.current.filter(
          (item): item is IFileUploadSucceededItem<TResult> =>
            item.status === 'succeeded' && !nextUploadIds.has(item.uploadId),
        );

        reportDiscardedItems(removedSuccessfulItems);
      }

      if (summary.failedFiles + summary.canceledFiles + summary.rejectedFiles > 0) {
        setIsManualSubmissionRequired(true);
      }

      itemsRef.current = nextItems;
      setItems(nextItems);
      onItemsChange?.(nextItems, summary);
    },
    [onItemsChange, reportDiscardedItems],
  );

  /** Latches user intent before notifying the consumer, including completion in this batch. */
  const handleUploadAreaExpand = useCallback((): void => {
    setIsManualSubmissionRequired(true);
    onUploadAreaExpand?.();
  }, [onUploadAreaExpand]);

  /** Handles both trigger-driven opening and user-driven dismissal. */
  const handleOpenChange = useCallback(
    (isOpen: boolean): void => {
      if (isOpen && !isSubmittingRef.current) {
        isSessionAbandonedRef.current = false;
        isFinalizedRef.current = false;
      }

      setInternalOpen(isOpen);
      onOpenChange?.(isOpen);
    },
    [onOpenChange],
  );

  /** Clears retained queue state only after the closing transition finishes. */
  const handleOpenChangeComplete = useCallback(
    (isOpen: boolean): void => {
      if (isOpen) {
        if (!isSubmittingRef.current) {
          isSessionAbandonedRef.current = false;
          isFinalizedRef.current = false;
        }
      } else {
        const isFinalizationPending = isSubmittingRef.current;

        if (isFinalizationPending) {
          isSessionAbandonedRef.current = true;
        } else if (!isFinalizedRef.current) {
          reportDiscardedItems(
            itemsRef.current.filter(
              (item): item is IFileUploadSucceededItem<TResult> => item.status === 'succeeded',
            ),
          );
        }
        isFinalizedRef.current = true;
        itemsRef.current = [];
        setItems([]);
        controlsRef.current?.reset();
        automaticSubmissionFingerprintRef.current = null;
        discardedUploadIdsRef.current.clear();
        isFinalizedRef.current = false;
        setIsManualSubmissionRequired(false);
        setSubmissionError(null);
      }

      onOpenChangeComplete?.(isOpen);
    },
    [onOpenChangeComplete, reportDiscardedItems],
  );

  useEffect(() => {
    if (
      !resolvedOpen ||
      isManualSubmissionRequired ||
      isSubmitting ||
      !isFileUploadQueueReady(items)
    ) {
      return;
    }

    const fingerprint = createSuccessfulQueueFingerprint(items);

    if (automaticSubmissionFingerprintRef.current === fingerprint) return;
    automaticSubmissionFingerprintRef.current = fingerprint;
    void submitSuccessfulItems(items);
  }, [isManualSubmissionRequired, isSubmitting, items, resolvedOpen, submitSuccessfulItems]);

  useEffect(() => {
    isMountedRef.current = true;
    isSessionAbandonedRef.current = false;

    return () => {
      isMountedRef.current = false;

      if (isFinalizedRef.current) return;
      isSessionAbandonedRef.current = true;
      if (isSubmittingRef.current) return;

      const successfulItems = itemsRef.current.filter(
        (item): item is IFileUploadSucceededItem<TResult> => item.status === 'succeeded',
      );
      reportDiscardedItems(successfulItems);
    };
  }, [reportDiscardedItems]);

  return (
    <Dialog
      {...dialogProps}
      open={resolvedOpen}
      isDismissalDisabled={isDismissalDisabled || isQueueBusy || isSubmitting}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      {trigger === undefined ? null : <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent
        forceMount
        size={size}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{policyDescription}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <FileUpload
            {...uploadProps}
            autoUpload
            controlsRef={controlsRef}
            disabled={isUploadDisabled || isSubmitting}
            isLabelVisible={false}
            isPolicyVisible={false}
            onItemsChange={handleItemsChange}
            onUploadAreaExpand={handleUploadAreaExpand}
          />
          {isManualSubmissionRequired ? (
            <p className="text-secondary-foreground mt-3 text-sm wrap-break-word">
              Choose {submitLabel} when all files are uploaded.
            </p>
          ) : null}
          {submissionError === null ? null : (
            <p
              role="alert"
              className="text-destructive mt-3 text-sm wrap-break-word"
            >
              {submissionError}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <DialogCancel asChild>
            <Button
              type="button"
              size="touch"
              variant="outline"
            >
              {closeLabel}
            </Button>
          </DialogCancel>
          <Button
            type="button"
            disabled={!isQueueReady || isQueueBusy || isSubmitting}
            size="touch"
            onClick={() => {
              if (isFileUploadQueueReady(items)) void submitSuccessfulItems(items);
            }}
          >
            {isSubmitting ? 'Submitting…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
