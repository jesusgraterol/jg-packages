// types
export type { IBreakpoint } from './breakpoint/index.js';
export type { IUseCopyFeedbackOptions, IUseCopyFeedbackResult } from './copy-feedback/index.js';
export type {
  IDialogSession,
  IDialogSessionOpenInit,
  IDialogSessionOptions,
  IDialogSessionSnapshot,
} from './dialog-session/index.js';
export type { IUseElementWidthResult } from './element-width/index.js';
export type {
  IFileUploadCanceledHandler,
  IFileUploadCanceledItem,
  IFileUploadControls,
  IFileUploadErrorDetails,
  IFileUploadErrorFeedback,
  IFileUploadFailedItem,
  IFileUploadFailureHandler,
  IFileUploadHandler,
  IFileUploadHandlerContext,
  IFileUploadItem,
  IFileUploadItemsChangeHandler,
  IFileUploadMessages,
  IFileUploadPolicy,
  IFileUploadPolicyOptions,
  IFileUploadProcessingItem,
  IFileUploadProgress,
  IFileUploadQueuedItem,
  IFileUploadRejectedHandler,
  IFileUploadRejectedItem,
  IFileUploadStatus,
  IFileUploadSucceededItem,
  IFileUploadSuccessHandler,
  IFileUploadSummary,
  IFileUploadUploadingItem,
  IFileUploadValidatingItem,
  IFileUploadValidationIssue,
  IFileUploadValidationReason,
  IFileUploadValidator,
  IFileUploadValidatorContext,
  IUseFileUploadQueueOptions,
  IUseFileUploadQueueResult,
} from './file-upload/index.js';
export type {
  IFormChangesComparable,
  IUseFormChangesOptions,
  IUseFormChangesResult,
} from './form-changes/index.js';
export type {
  IUseResendCooldownOptions,
  IUseResendCooldownResult,
} from './resend-cooldown/index.js';
export type { IAppliedThemeOptions, IThemeInitScriptOptions } from './theme/index.js';
export type {
  IUseDebouncedSearchOptions,
  IUseDebouncedSearchResult,
} from './debounced-search/index.js';
export type { IUseActiveHeadingOptions, IUseActiveHeadingResult } from './active-heading/index.js';

// error codes
export { ERRORS } from './shared/index.js';

// connectivity
export { useOnlineStatus } from './online-status/index.js';

// visibility
export { useDocumentVisibility } from './document-visibility/index.js';

// viewport
export { isBreakpointAtLeast, useBreakpoint } from './breakpoint/index.js';
export { useIsWindowScrolledPast } from './window-scroll/index.js';
export { useElementWidth } from './element-width/index.js';

// forms
export { useFormChanges } from './form-changes/index.js';
export { useResendCooldown } from './resend-cooldown/index.js';

// file uploads
export {
  createFileUploadAcceptValue,
  DEFAULT_FILE_UPLOAD_MESSAGES,
  hasDraggedFiles,
  isFileUploadItemCancelable,
  resolveFileUploadPolicy,
  useFileUploadQueue,
  validateFileUploadCandidate,
} from './file-upload/index.js';

// feedback
export { DEFAULT_COPY_FEEDBACK_SECONDS, useCopyFeedback } from './copy-feedback/index.js';

// dialogs
export { createDialogSession, useDialogSession } from './dialog-session/index.js';

// search
export { useDebouncedSearch } from './debounced-search/index.js';

// reading position
export { useActiveHeading } from './active-heading/index.js';

// theme
export {
  createThemeInitScript,
  useAppliedTheme,
  useDocumentTheme,
  useResolvedTheme,
} from './theme/index.js';
