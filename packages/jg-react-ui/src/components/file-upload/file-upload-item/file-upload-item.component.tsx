import { type ReactElement, memo } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock3,
  FileIcon,
  RefreshCcw,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';
import { prettifyFileSize } from 'jg-utilities';
import { cn } from 'cnfast';
import type { IFileUploadItem, IFileUploadStatus } from 'jg-react';

import { Badge } from '../../badge/index.js';
import { Button } from '../../button/index.js';
import { Progress } from '../../progress/index.js';
import { Spinner } from '../../spinner/index.js';
import type { IFileUploadPreviewRenderer } from '../types.js';

// internal row props keep all actions stable and identified by upload id.
type IFileUploadItemProps<TResult> = {
  disabled: boolean;
  item: IFileUploadItem<TResult>;
  onCancel: (uploadId: string) => void;
  onRemove: (uploadId: string) => void;
  onRetry: (uploadId: string) => void;
  renderPreview?: IFileUploadPreviewRenderer<TResult> | undefined;
  statusLabels: Record<IFileUploadStatus, string>;
};

/**
 * Renders one file's metadata, status, progress, error, preview, and available actions.
 * @param props The immutable queue item and stable action callbacks.
 * @returns A memoizable file queue row.
 */
const FileUploadItemComponent = <TResult,>({
  disabled,
  item,
  onCancel,
  onRemove,
  onRetry,
  renderPreview,
  statusLabels,
}: IFileUploadItemProps<TResult>): ReactElement => {
  const errorDetails =
    item.status === 'failed'
      ? item.error
      : item.status === 'rejected'
        ? item.validationIssue
        : null;
  const shouldShowProgress =
    item.status === 'uploading' ||
    item.status === 'processing' ||
    (item.status === 'failed' && item.progress.hasReportedProgress) ||
    item.status === 'succeeded';
  const statusLabel = statusLabels[item.status];

  return (
    <li
      data-slot="file-upload-item"
      data-status={item.status}
      className={cn(
        'border-border bg-background grid min-w-0 gap-3 rounded-lg border p-3 shadow-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:p-4',
        item.status === 'failed' || item.status === 'rejected'
          ? 'border-destructive/40 dark:border-destructive/50'
          : null,
      )}
    >
      <div
        data-slot="file-upload-item-preview"
        className="bg-secondary text-secondary-foreground flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg sm:size-14"
      >
        {renderPreview === undefined ? (
          <FileIcon
            aria-hidden="true"
            className="size-5"
          />
        ) : (
          renderPreview(item)
        )}
      </div>

      <div className="grid min-w-0 gap-3">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-foreground text-sm font-medium wrap-break-word">{item.file.name}</p>
            <p className="text-secondary-foreground mt-1 text-xs">
              {prettifyFileSize(item.file.size)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
            <FileUploadStatusIcon status={item.status} />
            <span>{statusLabel}</span>
          </div>
        </div>

        {shouldShowProgress ? (
          <div className="grid gap-1.5">
            <div className="text-secondary-foreground flex items-center justify-between gap-3 text-xs">
              <span>
                {item.status === 'processing'
                  ? 'Waiting for the upload result'
                  : item.status === 'succeeded'
                    ? 'Upload complete'
                    : item.progress.hasReportedProgress
                      ? `${prettifyFileSize(item.progress.uploadedBytes)} of ${prettifyFileSize(item.progress.totalBytes)}`
                      : 'Waiting for progress'}
              </span>
              {item.progress.hasReportedProgress && item.status !== 'processing' ? (
                <span>{item.progress.percentage}%</span>
              ) : null}
            </div>

            <Progress
              aria-label={`${item.file.name} upload progress`}
              value={item.progress.percentage}
            />
          </div>
        ) : null}

        {errorDetails !== null ? (
          <div
            data-slot="file-upload-item-error"
            className="text-destructive grid min-w-0 gap-2 text-sm"
          >
            <p className="wrap-break-word">{errorDetails.message}</p>
            {errorDetails.code !== null ? (
              <Badge
                title={`Error code ${errorDetails.code}`}
                variant="destructive"
                className="h-auto max-w-full justify-self-start py-1 font-mono break-all whitespace-normal"
              >
                Code {errorDetails.code}
              </Badge>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {item.status === 'validating' ||
          item.status === 'queued' ||
          item.status === 'uploading' ? (
            <Button
              className="whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              type="button"
              aria-label={`Cancel ${item.file.name}`}
              disabled={disabled}
              size="sm"
              variant="outline"
              onClick={() => onCancel(item.uploadId)}
            >
              <X
                data-icon="inline-start"
                aria-hidden="true"
              />
              Cancel
            </Button>
          ) : null}

          {item.status === 'failed' || item.status === 'canceled' ? (
            <Button
              className="whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              type="button"
              aria-label={`Retry ${item.file.name}`}
              disabled={disabled}
              size="sm"
              variant="outline"
              onClick={() => onRetry(item.uploadId)}
            >
              <RefreshCcw
                data-icon="inline-start"
                aria-hidden="true"
              />
              Retry
            </Button>
          ) : null}

          {item.status === 'failed' ||
          item.status === 'canceled' ||
          item.status === 'rejected' ||
          item.status === 'succeeded' ? (
            <Button
              className="whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              type="button"
              aria-label={`Remove ${item.file.name}`}
              disabled={disabled}
              size="sm"
              variant="ghost"
              onClick={() => onRemove(item.uploadId)}
            >
              <Trash2
                data-icon="inline-start"
                aria-hidden="true"
              />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
};

/**
 * Renders a memoized file row so progress updates do not rerender untouched files.
 */
export const FileUploadItem = memo(FileUploadItemComponent) as typeof FileUploadItemComponent;

/**
 * Selects the semantic status icon for one queue item.
 * @param props The current upload status.
 * @returns A decorative status icon or spinner.
 */
const FileUploadStatusIcon = ({ status }: { status: IFileUploadStatus }): ReactElement => {
  switch (status) {
    case 'validating':
    case 'processing':
      return (
        <Spinner
          aria-hidden="true"
          className="size-3.5"
        />
      );
    case 'queued':
      return (
        <Clock3
          aria-hidden="true"
          className="size-3.5"
        />
      );
    case 'uploading':
      return (
        <Upload
          aria-hidden="true"
          className="size-3.5"
        />
      );
    case 'succeeded':
      return (
        <CheckCircle2
          aria-hidden="true"
          data-slot="file-upload-success-icon"
          className="text-primary dark:text-primary-foreground size-3.5"
        />
      );
    case 'failed':
    case 'rejected':
      return (
        <TriangleAlert
          aria-hidden="true"
          className="text-destructive size-3.5"
        />
      );
    case 'canceled':
      return (
        <Ban
          aria-hidden="true"
          className="text-secondary-foreground size-3.5"
        />
      );
  }
};
