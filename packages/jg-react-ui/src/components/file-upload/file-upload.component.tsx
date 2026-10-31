import {
  type ReactElement,
  useId,
  useRef,
  useState,
  useMemo,
  useCallback,
  useLayoutEffect,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { Upload, X } from 'lucide-react';
import { prettifyFileSize } from 'jg-utilities';
import { cn } from 'cnfast';
import {
  createFileUploadAcceptValue,
  hasDraggedFiles,
  isFileUploadItemCancelable,
  useFileUploadQueue,
  type IFileUploadItemsChangeHandler,
  type IFileUploadSummary,
} from 'jg-react';

import { useErrorFeedbackResolver } from '../error-feedback-provider/index.js';

import { Button } from '../button/index.js';
import { Field, FieldDescription, Label } from '../form/index.js';
import { IconTile } from '../icon-tile/index.js';
import {
  FILE_UPLOAD_DEFAULT_BROWSE_LABEL,
  FILE_UPLOAD_DEFAULT_CANCEL_ALL_LABEL,
  FILE_UPLOAD_DEFAULT_DROP_ZONE_LABEL,
  FILE_UPLOAD_DEFAULT_HIDE_UPLOAD_AREA_LABEL,
  FILE_UPLOAD_DEFAULT_LABEL,
  FILE_UPLOAD_DEFAULT_SHOW_UPLOAD_AREA_LABEL,
  FILE_UPLOAD_DEFAULT_START_UPLOADS_LABEL,
  FILE_UPLOAD_STATUS_LABELS,
} from './constants.js';
import { FileUploadItem } from './file-upload-item/index.js';
import type { IFileUploadProps } from './types.js';
import { getFileUploadErrorFeedback } from './utilities.js';

/**
 * Renders a transport-neutral file picker with validation, bounded concurrency, and progress.
 * Collapses the selection area after uploading starts and preserves subsequent user toggles.
 * @param props The file policy, injected upload handler, lifecycle callbacks, and presentation.
 * @returns A responsive, accessible file upload queue.
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
 * import { FileUpload, type IFileUploadProps } from 'jg-react-ui/components/file-upload';
 * declare const uploadFile: IFileUploadProps<string>['uploadFile'];
 * const example = createElement(FileUpload<string>, { acceptedFileTypes: ['text/plain'], maxFileBytes: 4096, uploadFile });
 */
export const FileUpload = <TResult,>({
  acceptedFileTypes,
  allowDuplicateFiles,
  autoUpload,
  browseLabel,
  cancelAllLabel = FILE_UPLOAD_DEFAULT_CANCEL_ALL_LABEL,
  className,
  controlsRef,
  description,
  disabled = false,
  dropZoneClassName,
  dropZoneLabel,
  existingFiles,
  hideUploadAreaLabel = FILE_UPLOAD_DEFAULT_HIDE_UPLOAD_AREA_LABEL,
  inputProps,
  isLabelVisible = true,
  isPolicyVisible = true,
  label,
  listClassName,
  maxConcurrentUploads,
  maxFileBytes,
  maxFiles,
  maxTotalBytes,
  onFileRejected,
  onItemsChange,
  onUploadCanceled,
  onUploadFailure,
  onUploadSuccess,
  onUploadAreaExpand,
  renderPreview,
  replaceSingleFile,
  showUploadAreaLabel = FILE_UPLOAD_DEFAULT_SHOW_UPLOAD_AREA_LABEL,
  startUploadsLabel = FILE_UPLOAD_DEFAULT_START_UPLOADS_LABEL,
  statusLabels,
  uploadFile,
  validateFile,
  ...props
}: IFileUploadProps<TResult>): ReactElement => {
  const resolveErrorFeedback = useErrorFeedbackResolver();
  const resolveUploadError = useCallback(
    (error: unknown) => getFileUploadErrorFeedback(error, resolveErrorFeedback),
    [resolveErrorFeedback],
  );
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAreaRef = useRef<HTMLDivElement>(null);
  const uploadAreaToggleRef = useRef<HTMLButtonElement>(null);
  const shouldFocusUploadAreaToggleRef = useRef(false);
  const dragDepthRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadAreaState, setUploadAreaState] = useState<'initial' | 'collapsed' | 'expanded'>(
    'initial',
  );
  const resolvedStatusLabels = useMemo(
    () => ({ ...FILE_UPLOAD_STATUS_LABELS, ...statusLabels }),
    [statusLabels],
  );

  /** Preserves queue notifications while updating presentation only at queue boundaries. */
  const handleItemsChange = useCallback<IFileUploadItemsChangeHandler<TResult>>(
    (nextItems, nextSummary) => {
      if (nextItems.length === 0) {
        shouldFocusUploadAreaToggleRef.current = false;
        setUploadAreaState('initial');
      } else if (
        uploadAreaState === 'initial' &&
        nextItems.some((item) => item.attemptNumber > 0)
      ) {
        shouldFocusUploadAreaToggleRef.current =
          document.activeElement === inputRef.current ||
          uploadAreaRef.current?.contains(document.activeElement) === true;
        dragDepthRef.current = 0;
        setIsDragActive(false);
        setUploadAreaState('collapsed');
      }

      onItemsChange?.(nextItems, nextSummary);
    },
    [onItemsChange, uploadAreaState],
  );

  useLayoutEffect(() => {
    if (uploadAreaState === 'collapsed' && shouldFocusUploadAreaToggleRef.current) {
      shouldFocusUploadAreaToggleRef.current = false;
      uploadAreaToggleRef.current?.focus();
    }
  }, [uploadAreaState]);
  const {
    addFiles,
    announcement,
    cancelAllUploads,
    cancelUpload,
    items,
    policy,
    removeFile,
    retryUpload,
    startUploads,
    summary,
  } = useFileUploadQueue({
    acceptedFileTypes,
    allowDuplicateFiles,
    autoUpload,
    controlsRef,
    disabled,
    existingFiles,
    getErrorFeedback: resolveUploadError,
    isPreviewEnabled: renderPreview !== undefined,
    maxConcurrentUploads,
    maxFileBytes,
    maxFiles,
    maxTotalBytes,
    onFileRejected,
    onItemsChange: handleItemsChange,
    onUploadCanceled,
    onUploadFailure,
    onUploadSuccess,
    replaceSingleFile,
    uploadFile,
    validateFile,
  });
  const { 'aria-describedby': externalDescriptionId, ...nativeInputProps } = inputProps ?? {};
  const inputId = nativeInputProps.id ?? `${generatedId}-input`;
  const descriptionId = `${generatedId}-description`;
  const constraintsId = `${generatedId}-constraints`;
  const uploadAreaId = `${generatedId}-upload-area`;
  const isUploadAreaHidden = uploadAreaState === 'collapsed';
  const inputDescriptionIds = [
    description === undefined ? null : descriptionId,
    constraintsId,
    externalDescriptionId,
  ]
    .filter((descriptionIdentifier): descriptionIdentifier is string =>
      Boolean(descriptionIdentifier),
    )
    .join(' ');
  const resolvedLabel =
    label ??
    (policy.maxFiles === 1
      ? FILE_UPLOAD_DEFAULT_LABEL.replace('files', 'file')
      : FILE_UPLOAD_DEFAULT_LABEL);
  const resolvedBrowseLabel =
    browseLabel ??
    (policy.maxFiles === 1
      ? FILE_UPLOAD_DEFAULT_BROWSE_LABEL.replace('files', 'file')
      : FILE_UPLOAD_DEFAULT_BROWSE_LABEL);
  const resolvedDropZoneLabel =
    dropZoneLabel ??
    (policy.maxFiles === 1
      ? FILE_UPLOAD_DEFAULT_DROP_ZONE_LABEL.replace('files', 'a file')
      : FILE_UPLOAD_DEFAULT_DROP_ZONE_LABEL);
  const acceptedTypesLabel =
    policy.acceptedFileTypes.length === 0 ? 'Any file type' : policy.acceptedFileTypes.join(', ');
  const hasMultipleCancelableFiles =
    items.reduce(
      (cancelableFileCount, item) =>
        cancelableFileCount + (isFileUploadItemCancelable(item) ? 1 : 0),
      0,
    ) > 1;
  const hasVisibleQueue = items.length > 0;

  /** Reveals or hides selection without changing queue state or upload admission. */
  const handleUploadAreaToggle = useCallback((): void => {
    if (!disabled) {
      if (uploadAreaState === 'collapsed') {
        setUploadAreaState('expanded');
        onUploadAreaExpand?.();
      } else {
        dragDepthRef.current = 0;
        setIsDragActive(false);
        setUploadAreaState('collapsed');
      }
    }
  }, [disabled, onUploadAreaExpand, uploadAreaState]);

  /**
   * Opens the native picker through the visible keyboard-operable button.
   */
  const handleBrowse = useCallback((): void => {
    inputRef.current?.click();
  }, []);

  /**
   * Sends native input selections through the shared admission pipeline.
   * @param event The native file input change event.
   */
  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      if (event.currentTarget.files !== null) {
        addFiles(event.currentTarget.files);
      }

      event.currentTarget.value = '';
    },
    [addFiles],
  );

  /**
   * Activates the supplementary drop target for browser file drags.
   * @param event The drag-enter event.
   */
  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      if (disabled || !hasDraggedFiles(event.dataTransfer.types)) {
        return;
      }

      event.preventDefault();
      dragDepthRef.current += 1;
      setIsDragActive(true);
    },
    [disabled],
  );

  /**
   * Clears the active target after the final nested drag leaves.
   * @param event The drag-leave event.
   */
  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      if (disabled || !hasDraggedFiles(event.dataTransfer.types)) {
        return;
      }

      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

      if (dragDepthRef.current === 0) {
        setIsDragActive(false);
      }
    },
    [disabled],
  );

  /**
   * Keeps browser file drags eligible for a copy drop operation.
   * @param event The drag-over event.
   */
  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      if (disabled || !hasDraggedFiles(event.dataTransfer.types)) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [disabled],
  );

  /**
   * Sends dropped browser files through the same serialized admission pipeline.
   * @param event The file drop event.
   */
  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      if (disabled || !hasDraggedFiles(event.dataTransfer.types)) {
        return;
      }

      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDragActive(false);
      addFiles(event.dataTransfer.files);
    },
    [addFiles, disabled],
  );

  return (
    <Field
      data-slot="file-upload"
      data-disabled={disabled ? '' : undefined}
      className={cn('w-full min-w-0 gap-3', className)}
      {...props}
    >
      <div
        className={cn(
          'grid min-w-0 gap-2',
          !isLabelVisible && description === undefined ? 'sr-only' : null,
        )}
      >
        <Label
          htmlFor={inputId}
          className={isLabelVisible ? undefined : 'sr-only'}
        >
          {resolvedLabel}
        </Label>
        {description === undefined ? null : (
          <FieldDescription id={descriptionId}>{description}</FieldDescription>
        )}
      </div>

      <input
        {...nativeInputProps}
        ref={inputRef}
        id={inputId}
        type="file"
        accept={createFileUploadAcceptValue(policy.acceptedFileTypes)}
        aria-describedby={inputDescriptionIds}
        aria-invalid={summary.rejectedFiles + summary.failedFiles > 0 || undefined}
        className="sr-only"
        hidden={isUploadAreaHidden || nativeInputProps.hidden}
        tabIndex={isUploadAreaHidden ? -1 : nativeInputProps.tabIndex}
        disabled={disabled}
        multiple={policy.maxFiles > 1}
        onChange={handleInputChange}
      />

      <div
        ref={uploadAreaRef}
        id={uploadAreaId}
        hidden={isUploadAreaHidden}
        data-slot="file-upload-drop-zone"
        data-drag-active={isDragActive ? '' : undefined}
        className={cn(
          'border-border bg-background focus-within:ring-foreground focus-within:ring-offset-background dark:bg-border/20 grid min-w-0 justify-items-center gap-3 rounded-xl border border-dashed p-5 text-center transition-[background-color,border-color,box-shadow] focus-within:border-transparent focus-within:ring-2 focus-within:ring-offset-2 motion-reduce:transition-none sm:p-6',
          isDragActive
            ? 'border-primary bg-primary/5 dark:border-primary-foreground dark:bg-primary/10'
            : null,
          disabled ? 'cursor-not-allowed' : null,
          dropZoneClassName,
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <IconTile size="lg">
          <Upload aria-hidden="true" />
        </IconTile>

        <div className="grid min-w-0 gap-1">
          <p className="text-sm font-medium">{resolvedDropZoneLabel}</p>
          <p
            id={constraintsId}
            className={cn(
              'text-secondary-foreground text-xs wrap-break-word',
              isPolicyVisible ? undefined : 'sr-only',
            )}
          >
            {acceptedTypesLabel}. Up to {prettifyFileSize(policy.maxFileBytes)} per file
            {policy.maxTotalBytes === null
              ? `, ${policy.maxFiles} ${policy.maxFiles === 1 ? 'file' : 'files'} maximum.`
              : `, ${prettifyFileSize(policy.maxTotalBytes)} total, ${policy.maxFiles} ${policy.maxFiles === 1 ? 'file' : 'files'} maximum.`}
          </p>
        </div>

        <Button
          type="button"
          disabled={disabled}
          variant="outline"
          className="max-w-full whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          onClick={handleBrowse}
        >
          {resolvedBrowseLabel}
        </Button>
      </div>

      {hasVisibleQueue ? (
        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Upload queue</p>
              <p
                role="status"
                className="text-secondary-foreground mt-1 text-xs wrap-break-word"
              >
                {createFileUploadSummaryLabel(summary)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {uploadAreaState === 'initial' ? null : (
                <Button
                  ref={uploadAreaToggleRef}
                  type="button"
                  disabled={disabled}
                  size="touch"
                  variant="outline"
                  aria-controls={uploadAreaId}
                  aria-expanded={!isUploadAreaHidden}
                  onClick={handleUploadAreaToggle}
                >
                  {isUploadAreaHidden ? showUploadAreaLabel : hideUploadAreaLabel}
                </Button>
              )}

              {!policy.autoUpload && summary.validatingFiles + summary.queuedFiles > 0 ? (
                <Button
                  type="button"
                  disabled={disabled}
                  size="touch"
                  onClick={startUploads}
                >
                  <Upload
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                  {startUploadsLabel}
                </Button>
              ) : null}

              {hasMultipleCancelableFiles ? (
                <Button
                  type="button"
                  disabled={disabled}
                  size="touch"
                  variant="outline"
                  onClick={cancelAllUploads}
                >
                  <X
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                  {cancelAllLabel}
                </Button>
              ) : null}
            </div>
          </div>

          <ul className={cn('grid min-w-0 gap-2', listClassName)}>
            {items.map((item) => (
              <FileUploadItem
                key={item.uploadId}
                disabled={disabled}
                item={item}
                renderPreview={renderPreview}
                statusLabels={resolvedStatusLabels}
                onCancel={cancelUpload}
                onRemove={removeFile}
                onRetry={retryUpload}
              />
            ))}
          </ul>
        </div>
      ) : null}

      <span
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </span>
    </Field>
  );
};

/**
 * Formats the queue counts into a compact visible status sentence.
 * @param summary The current aggregate queue status.
 * @returns A readable queue status summary.
 */
const createFileUploadSummaryLabel = (summary: IFileUploadSummary): string => {
  const statusSegments = [
    summary.validatingFiles > 0 ? `${summary.validatingFiles} validating` : null,
    summary.queuedFiles > 0 ? `${summary.queuedFiles} queued` : null,
    summary.activeUploads > 0 ? `${summary.activeUploads} active` : null,
    summary.succeededFiles > 0 ? `${summary.succeededFiles} uploaded` : null,
    summary.failedFiles > 0 ? `${summary.failedFiles} failed` : null,
    summary.canceledFiles > 0 ? `${summary.canceledFiles} canceled` : null,
    summary.rejectedFiles > 0 ? `${summary.rejectedFiles} not accepted` : null,
  ].filter((statusSegment): statusSegment is string => statusSegment !== null);

  return statusSegments.join(', ');
};
