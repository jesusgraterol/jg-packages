import { type ReactNode, type ComponentPropsWithoutRef, type Ref } from 'react';
import type {
  IFileUploadCanceledHandler,
  IFileUploadControls,
  IFileUploadFailureHandler,
  IFileUploadHandler,
  IFileUploadItem,
  IFileUploadItemsChangeHandler,
  IFileUploadRejectedHandler,
  IFileUploadStatus,
  IFileUploadSuccessHandler,
  IFileUploadValidator,
} from 'jg-react';

/** Optional preview content for one typed upload queue item.
 * @see FileUpload
 */
export type IFileUploadPreviewRenderer<TResult> = (item: IFileUploadItem<TResult>) => ReactNode;

// native input customization excludes behavior owned by FileUpload.
type IFileUploadInputProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'accept' | 'children' | 'className' | 'disabled' | 'multiple' | 'onChange' | 'type' | 'value'
>;

/** Native field attributes, file admission policy, upload adapters, callbacks, and presentation.
 * @see FileUpload
 */
export type IFileUploadProps<TResult> = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'onChange'
> & {
  acceptedFileTypes: readonly string[];
  allowDuplicateFiles?: boolean;
  autoUpload?: boolean;
  browseLabel?: string;
  cancelAllLabel?: string;
  controlsRef?: Ref<IFileUploadControls>;
  description?: ReactNode;
  disabled?: boolean;
  dropZoneClassName?: string;
  dropZoneLabel?: string;
  // files already owned by the consumer participate in admission without joining the local queue.
  existingFiles?: readonly File[];
  // labels for the disclosure shown after the first upload attempt.
  hideUploadAreaLabel?: string;
  inputProps?: IFileUploadInputProps;
  isLabelVisible?: boolean;
  isPolicyVisible?: boolean;
  label?: ReactNode;
  listClassName?: string;
  maxConcurrentUploads?: number;
  maxFileBytes: number;
  maxFiles?: number;
  maxTotalBytes?: number;
  onFileRejected?: IFileUploadRejectedHandler;
  onItemsChange?: IFileUploadItemsChangeHandler<TResult>;
  onUploadCanceled?: IFileUploadCanceledHandler;
  onUploadFailure?: IFileUploadFailureHandler;
  onUploadSuccess?: IFileUploadSuccessHandler<TResult>;
  // fires only when the user reveals a collapsed upload area, never on queue-driven resets.
  onUploadAreaExpand?: () => void;
  renderPreview?: IFileUploadPreviewRenderer<TResult>;
  replaceSingleFile?: boolean;
  showUploadAreaLabel?: string;
  startUploadsLabel?: string;
  statusLabels?: Partial<Record<IFileUploadStatus, string>>;
  uploadFile: IFileUploadHandler<TResult>;
  validateFile?: IFileUploadValidator;
};
