import { cn } from 'cnfast';
import type * as React from 'react';

import type { IMarkdownEditorVariantProps } from './types.js';

/**
 * Renders a responsive, themed loading state while an editor implementation downloads.
 * @param props The editor props used to preserve layout and accessible naming.
 * @returns A React element that renders the editor loading placeholder.
 */
export const MarkdownEditorLoadingFallback = ({
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  className,
  disabled = false,
}: IMarkdownEditorVariantProps): React.ReactElement => (
  <div
    aria-busy="true"
    aria-describedby={ariaDescribedBy}
    aria-label={ariaLabel ?? 'Markdown editor'}
    className={cn(
      'bg-background text-secondary-foreground grid w-full grid-cols-1 max-w-full min-w-0 place-items-center rounded-md border border-border p-4 text-sm',
      className,
    )}
    data-disabled={disabled ? 'true' : undefined}
    data-editor-mode="document"
    data-slot="markdown-editor"
    role="status"
  >
    <span>Loading editor...</span>
  </div>
);
