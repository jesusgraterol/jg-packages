import { useId, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import type * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '../../button/index.js';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../dialog/index.js';
import { DEFAULT_FORM_PROPS, Field, FieldError, Input, Label } from '../../form/index.js';

import {
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_TITLE_PLACEHOLDER,
  MARKDOWN_EDITOR_YOUTUBE_VIDEO_URL_PLACEHOLDER,
} from './constants.js';
import type {
  IMarkdownEditorYouTubeVideoDialogProps,
  IMarkdownEditorYouTubeVideoFormInput,
  IMarkdownEditorYouTubeVideoFormValues,
} from './types.js';
import { MarkdownEditorYouTubeVideoFormSchema } from './validations.js';

/**
 * Creates raw form values from the current canonical descriptor.
 * @param initialDescriptor The optional descriptor supplied for an edit session.
 * @returns Authored URL and title values for the dialog form.
 */
const createMarkdownEditorYouTubeVideoFormValues = (
  initialDescriptor: IMarkdownEditorYouTubeVideoDialogProps['initialDescriptor'],
): IMarkdownEditorYouTubeVideoFormInput => ({
  youtubeVideoTitle: initialDescriptor?.title ?? '',
  youtubeVideoUrl: initialDescriptor?.watchUrl ?? '',
});

/**
 * Renders the validated add or edit form for one standalone YouTube video block.
 * @param props The controlled dialog session and completion callbacks.
 * @returns An accessible app-ui dialog for YouTube URL and title entry.
 */
export const MarkdownEditorYouTubeVideoDialog = ({
  initialDescriptor,
  mode,
  onClosed,
  onOpenChange,
  onSubmit,
  open,
  resolveReturnFocusElement,
}: IMarkdownEditorYouTubeVideoDialogProps): React.ReactElement => {
  const generatedId = useId().replaceAll(':', '');
  const urlInputId = `markdown-editor-youtube-video-url-${generatedId}`;
  const titleInputId = `markdown-editor-youtube-video-title-${generatedId}`;
  const urlErrorId = `${urlInputId}-error`;
  const hasOpenedRef = useRef(false);
  const isMountedRef = useRef(false);
  const resolveReturnFocusElementRef = useRef(resolveReturnFocusElement);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const form = useForm<
    IMarkdownEditorYouTubeVideoFormInput,
    unknown,
    IMarkdownEditorYouTubeVideoFormValues
  >({
    ...DEFAULT_FORM_PROPS,
    resolver: zodResolver(MarkdownEditorYouTubeVideoFormSchema),
    defaultValues: createMarkdownEditorYouTubeVideoFormValues(initialDescriptor),
  });
  const urlError = form.formState.errors.youtubeVideoUrl?.message;
  const isEditMode = mode === 'edit';

  useLayoutEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // each opened session starts from its current canonical values without retaining stale errors.
  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(createMarkdownEditorYouTubeVideoFormValues(initialDescriptor));
  }, [form, initialDescriptor, mode, open]);

  useEffect(() => {
    if (open) {
      resolveReturnFocusElementRef.current = resolveReturnFocusElement;
    }
  }, [open, resolveReturnFocusElement]);

  // wait for Base UI to remove modal inertness before restoring the retained editor target.
  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      return;
    }

    if (!hasOpenedRef.current) {
      return;
    }

    hasOpenedRef.current = false;

    const initialFocusElement = resolveReturnFocusElementRef.current();
    const ownerDocument = initialFocusElement?.ownerDocument ?? document;
    let isDisposed = false;
    const restoreFocus = (): void => {
      if (isDisposed) return;
      const finalFocusElement = resolveReturnFocusElementRef.current();
      if (!finalFocusElement?.isConnected) {
        observer.disconnect();
        return;
      }
      if (finalFocusElement.closest('[data-base-ui-inert]')) return;
      observer.disconnect();
      finalFocusElement.focus();
    };
    const observer = new MutationObserver(restoreFocus);
    observer.observe(ownerDocument.body, {
      attributeFilter: ['data-base-ui-inert'],
      attributes: true,
      subtree: true,
    });
    queueMicrotask(restoreFocus);
    return () => {
      isDisposed = true;
      observer.disconnect();
    };
  }, [open]);

  /**
   * Emits the resolver-normalized single-video descriptor.
   * @param values The canonical YouTube video descriptor.
   */
  const handleSubmit = useCallback(
    (values: IMarkdownEditorYouTubeVideoFormValues): void => {
      onSubmit(values);
    },
    [onSubmit],
  );

  /**
   * Clears the retained parent session after the close transition finishes.
   * @param isOpen Whether the dialog remains open.
   */
  const handleOpenChangeComplete = useCallback(
    (isOpen: boolean): void => {
      if (!isOpen) {
        onClosed();
      }
    },
    [onClosed],
  );

  /**
   * Returns focus to the editor or edit control that opened this session.
   * @returns The authoring control, null when absent, or false after unmount.
   */
  const resolveFinalFocus = useCallback((): HTMLElement | null | false => {
    if (!isMountedRef.current) return false;
    const finalFocusElement = resolveReturnFocusElement();

    return finalFocusElement?.isConnected
      ? finalFocusElement
      : resolveReturnFocusElementRef.current();
  }, [resolveReturnFocusElement]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={handleOpenChangeComplete}
    >
      <DialogContent
        finalFocus={resolveFinalFocus}
        initialFocus={urlInputRef}
        size="small"
      >
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit YouTube video' : 'Add YouTube video'}</DialogTitle>
          <DialogDescription>
            Add one supported YouTube URL. Playback uses the privacy-enhanced player and never
            starts automatically.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            className="grid grid-cols-1 gap-4"
            id={`youtube-form-${generatedId}`}
            noValidate
            onSubmit={(event) => {
              void form.handleSubmit(handleSubmit)(event);
            }}
          >
            <Field>
              <Label htmlFor={urlInputId}>YouTube URL</Label>
              <Controller
                control={form.control}
                name="youtubeVideoUrl"
                render={({ field }) => (
                  <Input
                    {...field}
                    aria-describedby={urlError ? urlErrorId : undefined}
                    aria-invalid={urlError ? true : undefined}
                    autoComplete="off"
                    id={urlInputId}
                    inputMode="url"
                    placeholder={MARKDOWN_EDITOR_YOUTUBE_VIDEO_URL_PLACEHOLDER}
                    ref={(element) => {
                      field.ref(element);
                      urlInputRef.current = element;
                    }}
                    required
                    type="url"
                  />
                )}
              />
              {urlError ? (
                <FieldError
                  id={urlErrorId}
                  role="alert"
                >
                  {urlError}
                </FieldError>
              ) : null}
            </Field>

            <Field>
              <Label htmlFor={titleInputId}>Title (optional)</Label>
              <Input
                {...form.register('youtubeVideoTitle')}
                autoComplete="off"
                id={titleInputId}
                placeholder={MARKDOWN_EDITOR_YOUTUBE_VIDEO_TITLE_PLACEHOLDER}
                type="text"
              />
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            form={`youtube-form-${generatedId}`}
            type="submit"
          >
            {isEditMode ? 'Save' : 'Add video'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
