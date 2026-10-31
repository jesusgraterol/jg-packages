import { type ReactNode, type ReactElement } from 'react';
import type { IFileUploadSucceededItem } from 'jg-react';

import type { IDialogProps, IDialogSize } from '../../dialog/index.js';
import type { IFileUploadProps } from '../types.js';

/** Finalizes a successful queue. Applications own idempotency and reconcile uncertain provider outcomes before retrying.
 * @see FileUploadDialog
 */
export type IFileUploadDialogSubmitHandler<TResult> = (
  items: readonly IFileUploadSucceededItem<TResult>[],
) => void | Promise<void>;

/** Receives discarded successful uploads synchronously before their local queue records disappear.
 * @see FileUploadDialog
 */
export type IFileUploadDialogDiscardHandler<TResult> = (
  items: readonly IFileUploadSucceededItem<TResult>[],
) => void;

// dialog-owned queue behavior cannot be overridden by consuming surfaces.
type IFileUploadDialogQueueProps<TResult> = Omit<
  IFileUploadProps<TResult>,
  | 'autoUpload'
  | 'controlsRef'
  | 'description'
  | 'isLabelVisible'
  | 'isPolicyVisible'
  | 'label'
  | 'startUploadsLabel'
>;

/** Controlled or default-open upload dialog with immediate transfers and recoverable finalization.
 * @see FileUploadDialog
 */
export type IFileUploadDialogProps<TResult> = Omit<IDialogProps, 'children'> & {
  closeLabel?: string;
  fileUploadProps: IFileUploadDialogQueueProps<TResult>;
  onDiscard?: IFileUploadDialogDiscardHandler<TResult>;
  onSubmit: IFileUploadDialogSubmitHandler<TResult>;
  size?: IDialogSize;
  submitLabel?: string;
  title?: ReactNode;
  trigger?: ReactElement;
};
