import type { Ref } from 'react';

// where a file is in its life in the queue
export type IFileUploadStatus =
  | 'validating'
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'rejected';

// why a file wasn't admitted: a built-in check, or the app's validator
export type IFileUploadValidationReason =
  | 'custom'
  | 'duplicate-file'
  | 'empty-file'
  | 'file-count-exceeded'
  | 'file-too-large'
  | 'total-size-exceeded'
  | 'unsupported-file-type';

// what the user sees about an error, as getErrorFeedback gives it
export type IFileUploadErrorFeedback = {
  // the message to show
  message: string;

  // a code the user may quote to support, or null
  code: string | null;
};

// an error's feedback, with the original error as its cause
export type IFileUploadErrorDetails = IFileUploadErrorFeedback & {
  cause: unknown;
};

// why a file wasn't admitted, with the message to show
export type IFileUploadValidationIssue = IFileUploadErrorDetails & {
  reason: IFileUploadValidationReason;
};

// how much of a file is uploaded; without a report yet, its total is the file's size
export type IFileUploadProgress = {
  hasReportedProgress: boolean;
  percentage: number;
  totalBytes: number;
  uploadedBytes: number;
};

// the fields every item has, whatever its status
type IFileUploadItemBase = {
  // the attempts started so far, 0 until the first
  attemptNumber: number;

  file: File;

  // an object URL of the file, with isPreviewEnabled, once it's queued
  previewUrl: string | null;

  progress: IFileUploadProgress;

  // the item's id, the same for every attempt
  uploadId: string;
};

// a file being checked
export type IFileUploadValidatingItem = IFileUploadItemBase & { status: 'validating' };

// a file admitted, waiting for a slot or for startUploads
export type IFileUploadQueuedItem = IFileUploadItemBase & { status: 'queued' };

// a file sending its bytes
export type IFileUploadUploadingItem = IFileUploadItemBase & { status: 'uploading' };

// every byte is sent and the upload waits for its result; it can't be canceled anymore
export type IFileUploadProcessingItem = IFileUploadItemBase & { status: 'processing' };

// a file uploaded, with what the upload resolved to
export type IFileUploadSucceededItem<TResult> = IFileUploadItemBase & {
  status: 'succeeded';
  result: TResult;
};

// a file whose upload failed, with what to show for its error
export type IFileUploadFailedItem = IFileUploadItemBase & {
  status: 'failed';
  error: IFileUploadErrorDetails;
};

// a file canceled before every byte was sent, which can be retried
export type IFileUploadCanceledItem = IFileUploadItemBase & { status: 'canceled' };

// a file not admitted, with the check that refused it
export type IFileUploadRejectedItem = IFileUploadItemBase & {
  status: 'rejected';
  validationIssue: IFileUploadValidationIssue;
};

// a file in the queue
export type IFileUploadItem<TResult> =
  | IFileUploadValidatingItem
  | IFileUploadQueuedItem
  | IFileUploadUploadingItem
  | IFileUploadProcessingItem
  | IFileUploadSucceededItem<TResult>
  | IFileUploadFailedItem
  | IFileUploadCanceledItem
  | IFileUploadRejectedItem;

// the queue's counts by status, and its progress weighted by bytes
export type IFileUploadSummary = {
  activeUploads: number;
  canceledFiles: number;
  failedFiles: number;
  progress: IFileUploadProgress;
  queuedFiles: number;
  rejectedFiles: number;
  succeededFiles: number;
  totalFiles: number;
  validatingFiles: number;
};

// what an upload attempt receives besides the file
export type IFileUploadHandlerContext = {
  // the attempt's number, from 1
  attemptNumber: number;

  // reports the bytes sent so far; reports are coalesced per frame and never go backwards
  reportProgress: (uploadedBytes: number, totalBytes: number) => void;

  // aborts when the upload is canceled, removed, replaced, or the hook unmounts
  signal: AbortSignal;

  // the item's id, the same for every attempt, as an idempotency key
  uploadId: string;
};

// uploads one file, resolving to what the app keeps, such as the stored file's URL
export type IFileUploadHandler<TResult> = (
  file: File,
  context: IFileUploadHandlerContext,
) => Promise<TResult>;

// what the app's validator receives besides the file
export type IFileUploadValidatorContext = {
  // the files admitted so far, the existing files included
  admittedFiles: readonly File[];

  // aborts when the file is canceled or removed while it's validated
  signal: AbortSignal;

  uploadId: string;
};

// checks a file the built-in checks admitted, such as an image's dimensions, resolving to an issue
// or null
export type IFileUploadValidator = (
  file: File,
  context: IFileUploadValidatorContext,
) => IFileUploadValidationIssue | null | Promise<IFileUploadValidationIssue | null>;

// what controls the queue
export type IFileUploadControls = {
  // validates the files and queues the ones admitted, one selection at a time
  addFiles: (files: Iterable<File>) => void;

  // cancels every file that hasn't finished sending its bytes
  cancelAllUploads: () => void;

  // cancels a file that hasn't finished sending its bytes
  cancelUpload: (uploadId: string) => void;

  // removes a file, canceling it first; a processing file stays
  removeFile: (uploadId: string) => void;

  // removes every file but the processing ones, canceling them first
  reset: () => void;

  // queues a failed or canceled file again, under the same id
  retryUpload: (uploadId: string) => void;

  // starts the queued files, without autoUpload
  startUploads: () => void;
};

// receives the items and their summary each time the queue changes
export type IFileUploadItemsChangeHandler<TResult> = (
  items: readonly IFileUploadItem<TResult>[],
  summary: IFileUploadSummary,
) => void;

// receives a file the checks refused
export type IFileUploadRejectedHandler = (item: IFileUploadRejectedItem) => void;

// receives a file once it's uploaded
export type IFileUploadSuccessHandler<TResult> = (item: IFileUploadSucceededItem<TResult>) => void;

// receives a file once its upload failed
export type IFileUploadFailureHandler = (item: IFileUploadFailedItem) => void;

// receives a file once it's canceled
export type IFileUploadCanceledHandler = (item: IFileUploadCanceledItem) => void;

// the text the queue shows and announces, which an app can translate or reword
export type IFileUploadMessages = {
  emptyFile: (fileName: string) => string;
  unsupportedFileType: (fileName: string, acceptedFileTypes: readonly string[]) => string;
  fileTooLarge: (fileName: string, maxFileBytes: number, excessBytes: number) => string;
  duplicateFile: (fileName: string) => string;
  fileCountExceeded: (maxFiles: number) => string;
  totalSizeExceeded: (fileName: string, maxTotalBytes: number) => string;

  // the message of a failed upload, or of a validator that threw, unless getErrorFeedback gives one
  uploadFailed: string;

  // announcements, for a polite live region
  fileIssue: (fileName: string, message: string) => string;
  queued: (fileName: string) => string;
  uploadStarted: (fileName: string) => string;
  uploadComplete: (fileName: string) => string;
  canceled: (fileName: string) => string;
  queuedForRetry: (fileName: string) => string;
  queueCleared: string;
  queueClearedWhileProcessing: string;
};

// the policy every file is checked against, as resolveFileUploadPolicy normalizes it
export type IFileUploadPolicy = {
  acceptedFileTypes: readonly string[];
  allowDuplicateFiles: boolean;
  autoUpload: boolean;
  maxConcurrentUploads: number;
  maxFileBytes: number;
  maxFiles: number;
  maxTotalBytes: number | null;
  replaceSingleFile: boolean;
};

// what resolveFileUploadPolicy takes
export type IFileUploadPolicyOptions = {
  // file extensions, such as `.png`, and MIME types, such as `image/png` or `image/*`; none
  // accepts every type
  acceptedFileTypes: readonly string[];

  // whether a file with the same name, size, type, and date as an admitted one is admitted.
  // Defaults to false
  allowDuplicateFiles?: boolean | undefined;

  // whether queued files start uploading at once. Defaults to true
  autoUpload?: boolean | undefined;

  // the most uploads running at once. Defaults to 2, and never more than maxFiles
  maxConcurrentUploads?: number | undefined;

  // the largest file accepted, in bytes
  maxFileBytes: number;

  // the most files admitted at once, the existing files included. Defaults to 1
  maxFiles?: number | undefined;

  // the most bytes admitted at once, the existing files included
  maxTotalBytes?: number | undefined;

  // with maxFiles 1, whether a new file replaces the current one, once it validates. Defaults to
  // true
  replaceSingleFile?: boolean | undefined;
};

// what useFileUploadQueue takes
export type IUseFileUploadQueueOptions<TResult> = IFileUploadPolicyOptions & {
  // uploads one file
  uploadFile: IFileUploadHandler<TResult>;

  // checks a file after the built-in checks pass
  validateFile?: IFileUploadValidator | undefined;

  // whether the queue ignores new files, retries, and starts; running work goes on
  disabled?: boolean | undefined;

  // files the app already has, such as saved attachments, which count toward the limits
  existingFiles?: readonly File[] | undefined;

  // whether each queued file gets an object URL for a preview
  isPreviewEnabled?: boolean | undefined;

  // text to use instead of DEFAULT_FILE_UPLOAD_MESSAGES' text
  messages?: Partial<IFileUploadMessages> | undefined;

  // what to show for a failed upload's error. Defaults to messages.uploadFailed, with no code
  getErrorFeedback?: ((error: unknown) => IFileUploadErrorFeedback) | undefined;

  // receives the controls, for a parent that drives the queue
  controlsRef?: Ref<IFileUploadControls> | undefined;

  // receive the queue's changes and its items' outcomes; an error they throw goes to reportError
  onItemsChange?: IFileUploadItemsChangeHandler<TResult> | undefined;
  onFileRejected?: IFileUploadRejectedHandler | undefined;
  onUploadSuccess?: IFileUploadSuccessHandler<TResult> | undefined;
  onUploadFailure?: IFileUploadFailureHandler | undefined;
  onUploadCanceled?: IFileUploadCanceledHandler | undefined;
};

// what useFileUploadQueue returns: its controls, its items and their summary, the latest
// announcement, and the policy
export type IUseFileUploadQueueResult<TResult> = IFileUploadControls & {
  announcement: string;
  items: readonly IFileUploadItem<TResult>[];
  policy: IFileUploadPolicy;
  summary: IFileUploadSummary;
};

// the queue's transitions
export type IFileUploadAction<TResult> =
  | { type: 'add-validating'; items: readonly IFileUploadValidatingItem[] }
  | { type: 'queue'; uploadId: string; previewUrl: string | null }
  | { type: 'reject'; uploadId: string; issue: IFileUploadValidationIssue }
  | { type: 'start'; uploadId: string; attemptNumber: number }
  | {
      type: 'progress';
      uploadId: string;
      attemptNumber: number;
      uploadedBytes: number;
      totalBytes: number;
    }
  | { type: 'succeed'; uploadId: string; attemptNumber: number; result: TResult }
  | { type: 'fail'; uploadId: string; attemptNumber: number; error: IFileUploadErrorDetails }
  | { type: 'cancel'; uploadId: string }
  | {
      type: 'restore';
      interruptedIds: ReadonlySet<string>;
      previewUrls: ReadonlyMap<string, string | null>;
    }
  | { type: 'retry'; uploadId: string }
  | { type: 'remove'; uploadId: string }
  | { type: 'reset' };
