import { useCallback } from 'react';
import type * as React from 'react';
import { Check, Clipboard } from 'lucide-react';
import { cn } from 'cnfast';
import { copyText } from 'jg-clipboard';
import { useCopyFeedback } from 'jg-react';

import { useErrorFeedbackResolver } from '../error-feedback-provider/index.js';

import { Button } from '../button/index.js';
import { toastr } from '../toastr/index.js';
import { COPY_BUTTON_FEEDBACK_DURATION_MS } from './constants.js';
import type { ICopyButtonProps } from './types.js';

/**
 * Renders a copy command with optional visible text and copied feedback, copying through
 * jg-clipboard's `copyText` and showing the copied state of jg-react's `useCopyFeedback`. The
 * value can be a function that reads the text after the click, such as a document the page loads
 * on demand.
 * @param props The text value to copy, or what reads it, and the shared button props to render.
 * @returns A React element that renders the copy command button.
 * @example
 * import { createElement } from 'react';
 * import { CopyButton } from 'jg-react-ui/components/copy-button';
 * const example = createElement(CopyButton, { value: 'pnpm build', copyLabel: 'Copy build command', size: 'icon-touch' });
 * @throws
 * - Button asChild requires exactly one valid React element child.
 * - INVALID_COPY_FEEDBACK_DURATION: The copy feedback duration must be a positive, finite number of seconds.
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
  const { isCopied, copy } = useCopyFeedback({
    durationSeconds: copiedFeedbackDuration / 1000,
    // a failed copy says so in a toast, unless it was cancelled; the hook calls the latest one
    onError: (error) => {
      const feedback = resolveErrorFeedback(error, {
        fallbackMessage: 'We could not copy this text. Select it and copy it manually.',
      });
      if (!feedback.isCancelled)
        toastr.error('Failed to write to Clipboard', { description: feedback.message });
    },
  });
  const visibleLabel = label === undefined ? undefined : isCopied ? copiedLabel : label;
  const buttonLabel =
    ariaLabel ??
    visibleLabel ??
    (isCopied ? 'Copied to Clipboard' : (copyLabel ?? 'Copy to Clipboard'));
  const buttonSize = size ?? (label === undefined ? 'icon' : 'default');

  // copies within the click, reading a value that loads after it through jg-clipboard
  const handleButtonClick = useCallback((): void => {
    void copy(() => copyText(typeof value === 'string' ? value : value()));
  }, [copy, value]);

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
