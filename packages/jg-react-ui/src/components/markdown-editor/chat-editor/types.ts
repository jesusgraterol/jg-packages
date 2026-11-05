import type * as React from 'react';

/** Chat authoring tools supported without document-only media or template features.
 * @see ChatMarkdownEditor
 */
export type IChatMarkdownEditorTool =
  | 'text'
  | 'heading'
  | 'bold'
  | 'italic'
  | 'link'
  | 'bullet-list'
  | 'ordered-list'
  | 'inline-code'
  | 'code-block'
  | 'table';

/** Block styles available in the chat formatting menu.
 * @see ChatMarkdownEditor
 */
export type IChatMarkdownBlockFormat =
  'paragraph' | 'heading-1' | 'heading-2' | 'heading-3' | 'bullet-list' | 'ordered-list';

/** Synchronous chat operations that retain the controlled draft during initialization.
 * @see ChatMarkdownEditor
 */
export type IChatMarkdownEditorControls = {
  /** Appends escaped text. Opted-in overflow is retained even before readiness; ordinary insertion stays bounded. */
  appendLiteralText: (text: string, options?: { allowOverLimit?: boolean }) => boolean;
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
  // Shift+Enter also requests submission, as Ctrl+Enter and Cmd+Enter do, in place of a line break
  isShiftEnterSubmit?: boolean;
  maxEditorHeight?: number;
  maxLength: number;
  onChange: (value: string) => void;
  onSubmitRequest?: (markdown: string) => void;
  placeholder?: string;
  // omitted keeps the simple seven-tool chat policy
  supportedTools?: ReadonlyArray<IChatMarkdownEditorTool>;
  value: string;
};

// policy callbacks let the mounted editor report safe, non-repeating user feedback.
export type IChatMarkdownPolicyOptions = {
  getMaxLength: () => number;
  getSupportedTools?: () => ReadonlyArray<IChatMarkdownEditorTool>;
  onNormalization: () => void;
  onPasteRejected: () => void;
};
