import type * as React from 'react';

/** Block formats supported by the fixed chat authoring policy.
 * @see ChatMarkdownEditor
 */
export type IChatMarkdownBlockFormat =
  'paragraph' | 'heading-1' | 'heading-2' | 'heading-3' | 'bullet-list' | 'ordered-list';

/** Synchronous chat operations that retain the controlled draft during initialization.
 * @see ChatMarkdownEditor
 */
export type IChatMarkdownEditorControls = {
  /** Appends escaped text; returns false before readiness or when the result exceeds maxLength. */
  appendLiteralText: (text: string) => boolean;
  /** Focuses the editor once initialization has completed. */
  focus: () => void;
  /** Reads live serialized Markdown, or the retained controlled draft during initialization. */
  getMarkdown: () => string;
};

// internal controls add formatting operations used by the package-owned toolbar.
export type IChatMarkdownEditorInternalControls = IChatMarkdownEditorControls & {
  applyBlockFormat: (format: IChatMarkdownBlockFormat) => void;
};

/** Controlled, length-bounded chat props with optional external formatting placement.
 * @see ChatMarkdownEditor
 */
export type IChatMarkdownEditorProps = Pick<
  React.ComponentProps<'div'>,
  'aria-describedby' | 'aria-invalid' | 'aria-label' | 'aria-required' | 'className'
> & {
  controlsRef?: React.Ref<IChatMarkdownEditorControls>;
  disabled?: boolean;
  // undefined keeps formatting inline; null reserves external placement until its container mounts.
  formattingContainer?: HTMLElement | null;
  maxEditorHeight?: number;
  maxLength: number;
  onChange: (value: string) => void;
  onSubmitRequest?: (markdown: string) => void;
  placeholder?: string;
  value: string;
};

// policy callbacks let the mounted editor report safe, non-repeating user feedback.
export type IChatMarkdownPolicyOptions = {
  getMaxLength: () => number;
  onNormalization: () => void;
  onPasteRejected: () => void;
};
