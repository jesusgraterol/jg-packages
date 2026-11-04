import { useId, useState } from 'react';
import type * as React from 'react';
import { cn } from 'cnfast';
import { useIsTextClamped } from 'jg-react';

import { CLAMPED_TEXT_LINE_CLASS_NAMES } from './constants.js';
import type { IClampedTextProps } from './types.js';

/**
 * Renders a text clamped to a few lines, with Show all only when the clamp cuts it off, and Show
 * less once it shows in full. It measures the text's full height, so a text that opens expanded
 * still offers Show less, and measures again as the text or its width changes. The toggle names
 * the text it controls and whether it's expanded, and sits in a row with any details, which wraps.
 * @param props The text, its lines, its expansion, the details beside the toggle, and its labels.
 * @returns A React element that renders the text and its toggle.
 * @example
 * import { createElement } from 'react';
 * import { ClampedText } from 'jg-react-ui/components/clamped-text';
 * const example = createElement(ClampedText, {
 *   textClassName: 'text-sm',
 *   children: 'A long description',
 * });
 */
export const ClampedText = ({
  children,
  lines = 3,
  isExpanded,
  onExpandedChange,
  details,
  className,
  textClassName,
  expandLabel = 'Show all',
  collapseLabel = 'Show less',
  id,
}: IClampedTextProps): React.ReactElement => {
  const generatedId = useId();
  const textId = id ?? generatedId;
  const [ownExpanded, setOwnExpanded] = useState(false);
  const isShownInFull = isExpanded ?? ownExpanded;
  const { ref, isClamped } = useIsTextClamped({ lines, content: children });
  const hasDetails = details !== undefined && details !== null;

  return (
    <div
      data-slot="clamped-text"
      className={cn('flex min-w-0 flex-col items-start gap-1.5', className)}
    >
      <p
        ref={ref}
        id={textId}
        className={cn(
          'max-w-full min-w-0 wrap-break-word',
          !isShownInFull && CLAMPED_TEXT_LINE_CLASS_NAMES[lines],
          textClassName,
        )}
      >
        {children}
      </p>
      {hasDetails || isClamped ? (
        <div
          data-slot="clamped-text-details"
          className="flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
        >
          {details}
          {isClamped ? (
            <button
              aria-controls={textId}
              aria-expanded={isShownInFull}
              data-slot="clamped-text-toggle"
              type="button"
              className="text-muted hover:text-foreground focus-visible:ring-foreground active:text-foreground -mx-1 inline-flex min-h-8 items-center rounded-md px-1 underline-offset-2 outline-none hover:underline focus-visible:ring-2 pointer-coarse:min-h-11"
              onClick={() => {
                setOwnExpanded(!isShownInFull);
                onExpandedChange?.(!isShownInFull);
              }}
            >
              {isShownInFull ? collapseLabel : expandLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
