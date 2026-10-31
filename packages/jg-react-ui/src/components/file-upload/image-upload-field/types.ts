import { type ComponentPropsWithoutRef, type ReactNode } from 'react';

import type {
  IFileUploadDialogDiscardHandler,
  IFileUploadDialogSubmitHandler,
} from '../file-upload-dialog/index.js';
import type { IFileUploadProps } from '../types.js';

/** Controlled image metadata. The consuming application owns the URL and its lifetime.
 * @see ImageUploadField
 */
export type IImageUploadFieldCurrentImage = {
  fileName: string;
  imageUrl: string;
};

/** Controlled image field with single-file replacement, finalization, and removal callbacks.
 * @see ImageUploadField
 */
export type IImageUploadFieldProps<TResult> = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'onChange' | 'onSubmit'
> &
  Pick<
    IFileUploadProps<TResult>,
    | 'acceptedFileTypes'
    | 'maxFileBytes'
    | 'onFileRejected'
    | 'onItemsChange'
    | 'onUploadCanceled'
    | 'onUploadFailure'
    | 'onUploadSuccess'
    | 'uploadFile'
    | 'validateFile'
  > & {
    chooseLabel?: string;
    currentImage?: IImageUploadFieldCurrentImage | null;
    description?: ReactNode;
    dialogTitle?: ReactNode;
    disabled?: boolean;
    error?: ReactNode;
    isLoading?: boolean;
    label?: ReactNode;
    onCurrentImageRemove?: () => void;
    onDiscard?: IFileUploadDialogDiscardHandler<TResult>;
    onSubmit: IFileUploadDialogSubmitHandler<TResult>;
    removeLabel?: string;
    replaceLabel?: string;
    submitLabel?: string;
  };
