import type {
  IFileUploadAction,
  IFileUploadCanceledItem,
  IFileUploadErrorDetails,
  IFileUploadErrorFeedback,
  IFileUploadItem,
  IFileUploadPolicy,
  IFileUploadProgress,
  IFileUploadSummary,
  IFileUploadValidatingItem,
  IFileUploadValidationIssue,
} from './types.js';
import { getAdmittedFileUploadFiles } from './transformers.js';

/**
 * Creates a file's progress before any report: nothing sent, out of the file's size.
 * @param totalBytes The file's size.
 * @returns The progress.
 */
export const createInitialFileUploadProgress = (totalBytes: number): IFileUploadProgress => ({
  hasReportedProgress: false,
  percentage: 0,
  totalBytes,
  uploadedBytes: 0,
});

/**
 * Creates the item of a file just selected, before it's checked.
 * @param file The file.
 * @param uploadId The item's id.
 * @returns The validating item.
 */
export const createValidatingFileUploadItem = (
  file: File,
  uploadId: string,
): IFileUploadValidatingItem => ({
  attemptNumber: 0,
  file,
  previewUrl: null,
  progress: createInitialFileUploadProgress(file.size),
  status: 'validating',
  uploadId,
});

/**
 * Applies a progress report. The first report's total is kept, and the uploaded bytes and the
 * percentage never go backwards. A report that isn't two safe integers, with a positive total,
 * changes nothing.
 * @param current The attempt's progress so far.
 * @param uploadedBytes The bytes reported sent.
 * @param totalBytes The total reported.
 * @returns The next progress, or the current one when nothing changes.
 */
export const normalizeFileUploadProgress = (
  current: IFileUploadProgress,
  uploadedBytes: number,
  totalBytes: number,
): IFileUploadProgress => {
  if (
    !Number.isSafeInteger(uploadedBytes) ||
    !Number.isSafeInteger(totalBytes) ||
    uploadedBytes < 0 ||
    totalBytes <= 0
  ) {
    return current;
  }
  const normalizedTotalBytes = current.hasReportedProgress ? current.totalBytes : totalBytes;
  const normalizedUploadedBytes = Math.max(
    current.uploadedBytes,
    Math.min(uploadedBytes, normalizedTotalBytes),
  );
  const percentage = Math.min(
    100,
    Math.max(
      current.percentage,
      Math.round((normalizedUploadedBytes / normalizedTotalBytes) * 100),
    ),
  );
  if (
    current.hasReportedProgress &&
    current.uploadedBytes === normalizedUploadedBytes &&
    current.percentage === percentage
  ) {
    return current;
  }
  return {
    hasReportedProgress: true,
    percentage,
    totalBytes: normalizedTotalBytes,
    uploadedBytes: normalizedUploadedBytes,
  };
};

/**
 * Gives a failure's feedback, with the error as its cause.
 * @param cause What the upload or the validator threw.
 * @param getErrorFeedback What to show for it.
 * @returns The error details.
 */
export const createFileUploadErrorDetails = (
  cause: unknown,
  getErrorFeedback: (error: unknown) => IFileUploadErrorFeedback,
): IFileUploadErrorDetails => {
  const { message, code } = getErrorFeedback(cause);
  return { cause, code, message };
};

/**
 * Turns an error the app's validator threw into a custom rejection.
 * @param cause What the validator threw.
 * @param getErrorFeedback What to show for it.
 * @returns The issue.
 */
export const createCustomFileUploadValidationIssue = (
  cause: unknown,
  getErrorFeedback: (error: unknown) => IFileUploadErrorFeedback,
): IFileUploadValidationIssue => ({
  ...createFileUploadErrorDetails(cause, getErrorFeedback),
  reason: 'custom',
});

/**
 * Counts a queue's items by status, and weighs its progress by bytes, leaving out the files not
 * admitted yet or rejected.
 * @param items The items.
 * @returns The summary.
 */
export const createFileUploadSummary = <TResult>(
  items: readonly IFileUploadItem<TResult>[],
): IFileUploadSummary => {
  const summary = {
    activeUploads: 0,
    canceledFiles: 0,
    failedFiles: 0,
    queuedFiles: 0,
    rejectedFiles: 0,
    succeededFiles: 0,
    validatingFiles: 0,
  };
  let totalBytes = 0;
  let uploadedBytes = 0;
  let hasUnknownActiveProgress = false;
  for (const item of items) {
    switch (item.status) {
      case 'validating':
        summary.validatingFiles += 1;
        continue;
      case 'rejected':
        summary.rejectedFiles += 1;
        continue;
      case 'queued':
        summary.queuedFiles += 1;
        break;
      case 'uploading':
        summary.activeUploads += 1;
        hasUnknownActiveProgress ||= !item.progress.hasReportedProgress;
        break;
      case 'processing':
        summary.activeUploads += 1;
        break;
      case 'succeeded':
        summary.succeededFiles += 1;
        break;
      case 'failed':
        summary.failedFiles += 1;
        break;
      case 'canceled':
        summary.canceledFiles += 1;
        break;
    }
    totalBytes += item.progress.totalBytes;
    uploadedBytes += item.progress.uploadedBytes;
  }
  const percentage = totalBytes === 0 ? 0 : Math.round((uploadedBytes / totalBytes) * 100);
  return {
    ...summary,
    progress: {
      hasReportedProgress: totalBytes > 0 && !hasUnknownActiveProgress,
      percentage: Math.min(100, Math.max(0, percentage)),
      totalBytes,
      uploadedBytes,
    },
    totalFiles: items.length,
  };
};

/**
 * Checks whether an item can still be canceled: it's validating, queued, or sending its bytes.
 * Once every byte is sent, it's processing, and it can't.
 * @param item The item.
 * @returns Whether it can be canceled.
 * @example
 * import { isFileUploadItemCancelable } from 'jg-react';
 *
 * declare const item: Parameters<typeof isFileUploadItemCancelable>[0];
 *
 * const canCancel = isFileUploadItemCancelable(item);
 */
export const isFileUploadItemCancelable = <TResult>(item: IFileUploadItem<TResult>): boolean =>
  item.status === 'validating' || item.status === 'queued' || item.status === 'uploading';

/**
 * Gives the fields every item has, without its status's own.
 * @param item The item.
 * @returns Its shared fields.
 */
const getItemBase = <TResult>(item: IFileUploadItem<TResult>) => ({
  attemptNumber: item.attemptNumber,
  file: item.file,
  previewUrl: item.previewUrl,
  progress: item.progress,
  uploadId: item.uploadId,
});

/**
 * Creates an item's canceled form, keeping its attempt and progress.
 * @param item The item.
 * @returns The canceled item.
 */
export const createCanceledFileUploadItem = <TResult>(
  item: IFileUploadItem<TResult>,
): IFileUploadCanceledItem => ({ ...getItemBase(item), status: 'canceled' });

/**
 * Applies a transition that targets one item, ignoring one that doesn't fit its status or attempt.
 * @param item The item.
 * @param action The transition.
 * @returns The next item, or the same one when the transition doesn't apply.
 */
const applyItemAction = <TResult>(
  item: IFileUploadItem<TResult>,
  action: Exclude<
    IFileUploadAction<TResult>,
    { type: 'add-validating' | 'remove' | 'reset' | 'restore' }
  >,
): IFileUploadItem<TResult> => {
  switch (action.type) {
    case 'queue':
      return item.status === 'validating'
        ? { ...getItemBase(item), previewUrl: action.previewUrl, status: 'queued' }
        : item;
    case 'reject':
      return item.status === 'validating'
        ? { ...getItemBase(item), status: 'rejected', validationIssue: action.issue }
        : item;
    case 'start':
      return item.status === 'queued'
        ? {
            ...getItemBase(item),
            attemptNumber: action.attemptNumber,
            progress: createInitialFileUploadProgress(item.file.size),
            status: 'uploading',
          }
        : item;
    case 'progress': {
      if (
        (item.status !== 'uploading' && item.status !== 'processing') ||
        item.attemptNumber !== action.attemptNumber
      ) {
        return item;
      }
      const progress = normalizeFileUploadProgress(
        item.progress,
        action.uploadedBytes,
        action.totalBytes,
      );
      // every byte is sent, so the upload waits for its result and can't be canceled
      return progress === item.progress
        ? item
        : {
            ...getItemBase(item),
            progress,
            status: progress.percentage === 100 ? 'processing' : 'uploading',
          };
    }
    case 'succeed':
      if (
        (item.status !== 'uploading' && item.status !== 'processing') ||
        item.attemptNumber !== action.attemptNumber
      ) {
        return item;
      }
      return {
        ...getItemBase(item),
        progress: {
          ...item.progress,
          hasReportedProgress: true,
          percentage: 100,
          uploadedBytes: item.progress.totalBytes,
        },
        result: action.result,
        status: 'succeeded',
      };
    case 'fail':
      if (
        (item.status !== 'uploading' && item.status !== 'processing') ||
        item.attemptNumber !== action.attemptNumber
      ) {
        return item;
      }
      return { ...getItemBase(item), error: action.error, status: 'failed' };
    case 'cancel':
      return isFileUploadItemCancelable(item) ? createCanceledFileUploadItem(item) : item;
    case 'retry':
      return item.status === 'failed' || item.status === 'canceled'
        ? {
            ...getItemBase(item),
            progress: createInitialFileUploadProgress(item.file.size),
            status: 'queued',
          }
        : item;
  }
};

/**
 * Restores items after their work was torn down, as when an `<Activity>` hid them: an item that
 * was validating, uploading, or processing becomes canceled, and a preview gets its new URL.
 * @param item The item.
 * @param interruptedIds The items whose work stopped.
 * @param previewUrls The new preview URLs, by item.
 * @returns The restored item, or the same one when nothing changes.
 */
const restoreItem = <TResult>(
  item: IFileUploadItem<TResult>,
  interruptedIds: ReadonlySet<string>,
  previewUrls: ReadonlyMap<string, string | null>,
): IFileUploadItem<TResult> => {
  const previewUrl = previewUrls.get(item.uploadId);
  const restored =
    previewUrl === undefined || previewUrl === item.previewUrl ? item : { ...item, previewUrl };
  return interruptedIds.has(item.uploadId) &&
    (restored.status === 'validating' ||
      restored.status === 'uploading' ||
      restored.status === 'processing')
    ? createCanceledFileUploadItem(restored)
    : restored;
};

/**
 * Applies a transition to the queue, keeping every item it doesn't change, and the queue itself
 * when nothing changes. A processing item survives removal and reset, since its bytes are sent.
 * @param items The items.
 * @param action The transition.
 * @returns The next items.
 */
export const fileUploadReducer = <TResult>(
  items: readonly IFileUploadItem<TResult>[],
  action: IFileUploadAction<TResult>,
): readonly IFileUploadItem<TResult>[] => {
  switch (action.type) {
    case 'add-validating':
      return action.items.length === 0 ? items : [...items, ...action.items];
    case 'reset': {
      const processingItems = items.filter((item) => item.status === 'processing');
      return processingItems.length === items.length ? items : processingItems;
    }
    case 'remove': {
      const nextItems = items.filter(
        (item) => item.uploadId !== action.uploadId || item.status === 'processing',
      );
      return nextItems.length === items.length ? items : nextItems;
    }
    case 'restore': {
      const nextItems = items.map((item) =>
        restoreItem(item, action.interruptedIds, action.previewUrls),
      );
      return nextItems.every((item, index) => item === items[index]) ? items : nextItems;
    }
    default: {
      let hasChanged = false;
      const nextItems = items.map((item) => {
        if (item.uploadId !== action.uploadId) {
          return item;
        }
        const nextItem = applyItemAction(item, action);
        hasChanged ||= nextItem !== item;
        return nextItem;
      });
      return hasChanged ? nextItems : items;
    }
  }
};

/**
 * Gives the files a candidate is checked against: the existing files, and the queue's admitted
 * files, unless a single file is being replaced and nothing it can't replace is in the way.
 * @param existingFiles The files the app already has.
 * @param items The queue's items.
 * @param candidateUploadIds The items of the selection being admitted.
 * @param policy The policy.
 * @param hasAdmittedReplacement Whether this selection already admitted a replacement.
 * @returns The files that count toward the candidate's limits.
 */
export const getCandidateAdmissionFiles = <TResult>(
  existingFiles: readonly File[],
  items: readonly IFileUploadItem<TResult>[],
  candidateUploadIds: ReadonlySet<string>,
  policy: IFileUploadPolicy,
  hasAdmittedReplacement: boolean,
): File[] => {
  const hasCommittedProcessingFile = items.some(
    (item) => item.status === 'processing' && !candidateUploadIds.has(item.uploadId),
  );
  const isReplacing =
    policy.replaceSingleFile &&
    existingFiles.length === 0 &&
    !hasAdmittedReplacement &&
    !hasCommittedProcessingFile;
  return [...existingFiles, ...(isReplacing ? [] : getAdmittedFileUploadFiles(items))];
};

/**
 * Checks whether a drag carries files, so a drop zone can react to it.
 * @param dragTypes The drag's types, such as `event.dataTransfer.types`.
 * @returns Whether it carries files.
 * @example
 * import { hasDraggedFiles } from 'jg-react';
 *
 * const onDragOver = (event: DragEvent) => {
 *   if (event.dataTransfer !== null && hasDraggedFiles(event.dataTransfer.types)) {
 *     event.preventDefault();
 *   }
 * };
 */
export const hasDraggedFiles = (dragTypes: readonly string[] | DOMStringList): boolean =>
  Array.from(dragTypes).includes('Files');

/**
 * Reports an error that mustn't stop the queue, such as one a callback threw, the way the browser
 * reports an uncaught error, without throwing it.
 * @param error The error.
 */
export const reportUnexpectedError = (error: unknown): void => {
  globalThis.reportError(error);
};

/**
 * Calls an app's callback, reporting an error it throws instead of letting it stop the queue.
 * @param callback The callback, if any.
 * @param args Its arguments.
 */
export const invokeCallback = <TArgs extends unknown[]>(
  callback: ((...args: TArgs) => void) | undefined,
  ...args: TArgs
): void => {
  if (callback === undefined) {
    return;
  }
  try {
    callback(...args);
  } catch (error) {
    reportUnexpectedError(error);
  }
};
