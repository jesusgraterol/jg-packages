import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { Check, Clipboard } from 'lucide-react';
import { cn } from 'cnfast';

import { useErrorFeedbackResolver } from '../error-feedback-provider/index.js';

import { Button } from '../button/index.js';
import { toastr } from '../toastr/index.js';
import { COPY_BUTTON_FEEDBACK_DURATION_MS } from './constants.js';
import type { ICopyButtonProps } from './types.js';

/**
 * Renders a copy command with optional visible text and copied feedback.
 * @param props The text value to copy and the shared button props to render.
 * @returns A React element that renders the copy command button.
 * @example
 * import { createElement } from 'react';
 * import { CopyButton } from 'jg-react-ui/components/copy-button';
 * const example = createElement(CopyButton, { value: 'pnpm build', copyLabel: 'Copy build command', size: 'icon-touch' });
 * @throws
 * - Button asChild requires exactly one valid React element child.
 */
export const CopyButton = ({
  'aria-label': ariaLabel,
  className,
  copiedFeedbackDuration = COPY_BUTTON_FEEDBACK_DURATION_MS,
  copiedLabel = 'Copied',
  copyLabel,
  disabled,
  label,
  size,
  title,
  value,
  variant = 'ghost',
  ...props
}: ICopyButtonProps): React.ReactElement => {
  const resolveErrorFeedback = useErrorFeedbackResolver();
  const resolveErrorFeedbackRef = useRef(resolveErrorFeedback);
  useLayoutEffect(() => {
    resolveErrorFeedbackRef.current = resolveErrorFeedback;
  });
  const [isCopied, setIsCopied] = useState(false);
  const isWritingRef = useRef(false);
  const isMountedRef = useRef(true);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const visibleLabel = label === undefined ? undefined : isCopied ? copiedLabel : label;
  const buttonLabel =
    ariaLabel ??
    visibleLabel ??
    (isCopied ? 'Copied to Clipboard' : (copyLabel ?? 'Copy to Clipboard'));
  const buttonSize = size ?? (label === undefined ? 'icon' : 'default');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Writes the configured value to the Clipboard and updates feedback state.
   * @returns A promise that resolves after the copy attempt finishes.
   */
  const handleCopyClick = useCallback(async (): Promise<void> => {
    if (isWritingRef.current) {
      return;
    }

    isWritingRef.current = true;
    setIsCopied(false);

    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }

    try {
      if (
        typeof navigator === 'undefined' ||
        typeof navigator.clipboard?.writeText !== 'function'
      ) {
        toastr.error('Failed to write to Clipboard', {
          description: 'We could not copy this text. Select it and copy it manually.',
        });
        return;
      }
      // invoke within the initiating gesture; do not await capability checks or lazy imports.
      await navigator.clipboard.writeText(value);
      if (!isMountedRef.current) return;
      setIsCopied(true);
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
        feedbackTimeoutRef.current = null;
      }, copiedFeedbackDuration);
    } catch (error) {
      if (!isMountedRef.current) return;
      setIsCopied(false);
      const feedback = resolveErrorFeedbackRef.current(error, {
        fallbackMessage: 'We could not copy this text. Select it and copy it manually.',
      });
      if (!feedback.isCancelled)
        toastr.error('Failed to write to Clipboard', { description: feedback.message });
    } finally {
      isWritingRef.current = false;
    }
  }, [copiedFeedbackDuration, value]);

  /**
   * Starts the asynchronous copy flow without leaking a promise to the click handler contract.
   */
  const handleButtonClick = useCallback((): void => {
    void handleCopyClick();
  }, [handleCopyClick]);

  return (
    <>
      <Button
        aria-label={buttonLabel}
        data-copied={isCopied ? 'true' : 'false'}
        disabled={disabled}
        size={buttonSize}
        title={title ?? buttonLabel}
        type="button"
        variant={variant}
        className={className}
        onClick={handleButtonClick}
        {...props}
      >
        <span className="relative size-4">
          <Clipboard
            aria-hidden="true"
            data-slot="copy-button-clipboard-icon"
            className={cn(
              'absolute inset-0 size-4 transition-all duration-200 motion-reduce:transition-none',
              isCopied ? 'scale-75 opacity-0' : 'scale-100 opacity-100',
            )}
          />
          <Check
            aria-hidden="true"
            data-slot="copy-button-success-icon"
            className={cn(
              'absolute inset-0 size-4 transition-all duration-200 motion-reduce:transition-none',
              isCopied ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
            )}
          />
        </span>
        {visibleLabel === undefined ? null : <span>{visibleLabel}</span>}
      </Button>
      {copyLabel === undefined ? null : (
        <span
          role="status"
          className="sr-only"
        >
          {isCopied ? 'Copied to Clipboard' : ''}
        </span>
      )}
    </>
  );
};
