import { useRef, useState, useId, useImperativeHandle, useCallback } from 'react';
import type * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from 'cnfast';

import { MarkdownEditorContent } from '../markdown-editor-content.component.js';
import {
  CHAT_MARKDOWN_EDITOR_DEFAULT_MAX_HEIGHT,
  CHAT_MARKDOWN_EDITOR_NORMALIZED_MESSAGE,
  CHAT_MARKDOWN_EDITOR_PASTE_TOO_LONG_MESSAGE,
  CHAT_MARKDOWN_EDITOR_TOOLS,
} from './constants.js';
import { ChatMarkdownFormatting } from './formatting/index.js';
import type {
  IChatMarkdownEditorControls,
  IChatMarkdownEditorInternalControls,
  IChatMarkdownEditorProps,
} from './types.js';

const assertChatMarkdownEditorConfiguration = (
  maxLength: number,
  maxEditorHeight: number,
): void => {
  if (!Number.isSafeInteger(maxLength) || maxLength <= 0) {
    throw new Error('ChatMarkdownEditor maxLength must be a positive safe integer.');
  }

  if (!Number.isFinite(maxEditorHeight) || maxEditorHeight <= 0) {
    throw new Error('ChatMarkdownEditor maxEditorHeight must be a positive finite number.');
  }
};

/**
 * Renders the fixed-policy rich Markdown editor used by chat composer surfaces.
 * @param props The controlled value, serialized length limit, controls, and accessibility props.
 * @returns A compact, growing rich-text editor with block and selection formatting controls.
 * @throws
 * - ChatMarkdownEditor maxLength must be a positive safe integer.
 * - ChatMarkdownEditor maxEditorHeight must be a positive finite number.
 * @example
 * import { createElement } from 'react';
 * import { ChatMarkdownEditor } from 'jg-react-ui/components/markdown-editor';
 * const editor = createElement(ChatMarkdownEditor, { value: '', maxLength: 2048, onChange: () => {} });
 */
export const ChatMarkdownEditor = ({
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel = 'Message',
  'aria-required': ariaRequired,
  className,
  controlsRef,
  disabled = false,
  formattingContainer,
  maxEditorHeight = CHAT_MARKDOWN_EDITOR_DEFAULT_MAX_HEIGHT,
  maxLength,
  onChange,
  onSubmitRequest,
  placeholder = 'e.g. Describe what you need help with',
  value,
}: IChatMarkdownEditorProps): React.ReactElement => {
  assertChatMarkdownEditorConfiguration(maxLength, maxEditorHeight);

  const internalControlsRef = useRef<IChatMarkdownEditorInternalControls>(null);
  const policySnapshotRef = useRef<string | null>(null);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);
  const isOverLimit = value.length > maxLength;
  const isCharacterCountVisible = value.length >= maxLength * 0.8;
  const hasVisibleStatus = isOverLimit || policyMessage !== null || isCharacterCountVisible;
  const statusId = useId();
  const describedBy = [ariaDescribedBy, statusId].filter(Boolean).join(' ');
  const editorStyle = {
    '--chat-markdown-editor-max-height': `${maxEditorHeight}px`,
  } as React.CSSProperties;
  const formattingControl = (
    <ChatMarkdownFormatting
      controlsRef={internalControlsRef}
      disabled={disabled}
    />
  );
  const resolvedFormattingControl =
    formattingContainer === undefined
      ? formattingControl
      : formattingContainer
        ? createPortal(formattingControl, formattingContainer)
        : null;

  useImperativeHandle<IChatMarkdownEditorControls, IChatMarkdownEditorControls>(
    controlsRef,
    () => ({
      appendLiteralText: (text) => internalControlsRef.current?.appendLiteralText(text) ?? false,
      focus: () => internalControlsRef.current?.focus(),
      getMarkdown: () => internalControlsRef.current?.getMarkdown() ?? value,
    }),
    [value],
  );

  const handleChange = useCallback(
    (nextValue: string): void => {
      if (nextValue !== policySnapshotRef.current) {
        policySnapshotRef.current = null;
        setPolicyMessage(null);
      }
      onChange(nextValue);
    },
    [onChange],
  );

  const handleNormalization = useCallback((): void => {
    policySnapshotRef.current = internalControlsRef.current?.getMarkdown() ?? null;
    setPolicyMessage(CHAT_MARKDOWN_EDITOR_NORMALIZED_MESSAGE);
  }, []);

  const handlePasteRejected = useCallback((): void => {
    policySnapshotRef.current = internalControlsRef.current?.getMarkdown() ?? null;
    setPolicyMessage(CHAT_MARKDOWN_EDITOR_PASTE_TOO_LONG_MESSAGE);
  }, []);

  return (
    <div
      style={editorStyle}
      data-slot="chat-markdown-editor-container"
      className={cn('flex min-w-0 items-end gap-1', className)}
    >
      {resolvedFormattingControl}
      <div className="min-w-0 flex-1">
        <MarkdownEditorContent
          aria-describedby={describedBy}
          aria-invalid={ariaInvalid || isOverLimit || undefined}
          aria-label={ariaLabel}
          aria-required={ariaRequired}
          chatOptions={{
            controlsRef: internalControlsRef,
            getMaxLength: () => maxLength,
            onNormalization: handleNormalization,
            onPasteRejected: handlePasteRejected,
            onSubmitRequest,
          }}
          disabled={disabled}
          editorMode="chat"
          isDarkMode={false}
          onChange={handleChange}
          placeholder={placeholder}
          supportedTools={CHAT_MARKDOWN_EDITOR_TOOLS}
          value={value}
        />
        <div
          id={statusId}
          aria-live="polite"
          data-slot="chat-markdown-editor-status"
          className={cn(
            'text-xs',
            hasVisibleStatus
              ? 'mt-1 flex min-h-4 items-center justify-between gap-2 px-2'
              : 'sr-only',
            isOverLimit ? 'text-destructive' : 'text-secondary-foreground',
          )}
        >
          <span>
            {isOverLimit ? 'The message is longer than the allowed limit.' : policyMessage}
          </span>
          <span className={isCharacterCountVisible ? 'shrink-0 tabular-nums' : 'sr-only'}>
            {value.length}/{maxLength}
          </span>
        </div>
      </div>
    </div>
  );
};
