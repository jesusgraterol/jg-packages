import { type ReactElement, useId, useState } from 'react';
import { ImageIcon, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { cn } from 'cnfast';

import { Button } from '../../button/index.js';
import { Field, FieldDescription, Label } from '../../form/index.js';
import { FileUploadDialog } from '../file-upload-dialog/index.js';
import type { IImageUploadFieldProps } from './types.js';

/**
 * Renders a controlled image asset card backed by the shared upload dialog.
 * @param props The current image, upload policy, finalization callbacks, and presentation.
 * @returns A responsive asset card for choosing, replacing, or removing one image.
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
 * import { ImageUploadField, type IImageUploadFieldProps } from 'jg-react-ui/components/file-upload';
 * declare const uploadFile: IImageUploadFieldProps<string>['uploadFile'];
 * declare const onSubmit: IImageUploadFieldProps<string>['onSubmit'];
 * const example = createElement(ImageUploadField<string>, { acceptedFileTypes: ['image/png'], maxFileBytes: 4096, uploadFile, onSubmit });
 */
export const ImageUploadField = <TResult,>({
  acceptedFileTypes,
  chooseLabel = 'Choose image',
  className,
  currentImage = null,
  description,
  dialogTitle = 'Upload image',
  disabled = false,
  error,
  isLoading = false,
  label = 'Image',
  maxFileBytes,
  onCurrentImageRemove,
  onDiscard,
  onFileRejected,
  onItemsChange,
  onSubmit,
  onUploadCanceled,
  onUploadFailure,
  onUploadSuccess,
  removeLabel = 'Remove',
  replaceLabel = 'Replace',
  submitLabel = 'Use image',
  uploadFile,
  validateFile,
  ...props
}: IImageUploadFieldProps<TResult>): ReactElement => {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const descriptionId = `${generatedId}-description`;
  const errorId = `${generatedId}-error`;
  const isDisabled = disabled || isLoading;

  return (
    <Field
      data-slot="image-upload-field"
      data-disabled={isDisabled ? '' : undefined}
      className={cn('w-full min-w-0 gap-3', className)}
      {...props}
    >
      <div className="grid min-w-0 gap-1.5">
        <Label id={labelId}>{label}</Label>
        {description === undefined ? null : (
          <FieldDescription id={descriptionId}>{description}</FieldDescription>
        )}
      </div>

      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={
          [description === undefined ? null : descriptionId, error === undefined ? null : errorId]
            .filter((id): id is string => id !== null)
            .join(' ') || undefined
        }
        aria-busy={isLoading || undefined}
        className={cn(
          'border-border bg-background grid min-w-0 gap-3 rounded-xl border p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center',
          isDisabled ? 'opacity-60' : null,
        )}
      >
        <div className="bg-secondary text-secondary-foreground flex aspect-video w-full min-w-0 items-center justify-center overflow-hidden rounded-lg sm:aspect-square sm:size-24">
          {currentImage === null ? (
            <ImageIcon
              aria-hidden="true"
              className="size-6"
            />
          ) : (
            <ImageUploadPreview
              key={currentImage.imageUrl}
              imageUrl={currentImage.imageUrl}
            />
          )}
        </div>

        <div className="grid min-w-0 gap-3">
          <div className="min-w-0">
            <p className="text-foreground text-sm font-medium wrap-break-word">
              {currentImage?.fileName ?? 'No image selected'}
            </p>
            <p className="text-secondary-foreground mt-1 text-xs">
              {isLoading
                ? 'Updating image…'
                : currentImage === null
                  ? 'Choose an image to continue'
                  : 'Image ready'}
            </p>
          </div>

          {error === undefined ? null : (
            <p
              id={errorId}
              role="alert"
              className="text-destructive text-sm wrap-break-word"
            >
              {error}
            </p>
          )}

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <FileUploadDialog
              fileUploadProps={{
                acceptedFileTypes,
                disabled: isDisabled,
                maxConcurrentUploads: 1,
                maxFileBytes,
                maxFiles: 1,
                ...(onFileRejected === undefined ? {} : { onFileRejected }),
                ...(onItemsChange === undefined ? {} : { onItemsChange }),
                ...(onUploadCanceled === undefined ? {} : { onUploadCanceled }),
                ...(onUploadFailure === undefined ? {} : { onUploadFailure }),
                ...(onUploadSuccess === undefined ? {} : { onUploadSuccess }),
                replaceSingleFile: true,
                uploadFile,
                ...(validateFile === undefined ? {} : { validateFile }),
              }}
              {...(onDiscard === undefined ? {} : { onDiscard })}
              onSubmit={onSubmit}
              submitLabel={submitLabel}
              title={dialogTitle}
              trigger={
                <Button
                  className="whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  type="button"
                  disabled={isDisabled}
                  size="sm"
                  variant="outline"
                >
                  {isLoading ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                  ) : (
                    <Upload
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                  )}
                  {currentImage === null ? chooseLabel : replaceLabel}
                </Button>
              }
            />

            {currentImage === null || onCurrentImageRemove === undefined ? null : (
              <Button
                className="whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                type="button"
                disabled={isDisabled}
                size="sm"
                variant="ghost"
                onClick={onCurrentImageRemove}
              >
                <Trash2
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                {removeLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Field>
  );
};

/** Preserves the preview geometry after failure; a changed source starts a new load attempt. */
const ImageUploadPreview = ({ imageUrl }: { imageUrl: string }): ReactElement => {
  const [hasFailed, setHasFailed] = useState(false);
  return hasFailed ? (
    <ImageIcon
      aria-hidden="true"
      className="size-6"
    />
  ) : (
    <img
      alt=""
      className="size-full object-cover"
      height={96}
      src={imageUrl}
      width={96}
      onError={() => setHasFailed(true)}
    />
  );
};
