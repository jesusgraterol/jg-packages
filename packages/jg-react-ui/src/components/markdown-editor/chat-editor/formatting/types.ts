import type * as React from 'react';

import type { IChatMarkdownBlockFormat, IChatMarkdownEditorInternalControls } from '../types.js';

// package-owned formatting props bind the compact menu to one live editor instance.
export type IChatMarkdownFormattingProps = {
  controlsRef: React.RefObject<IChatMarkdownEditorInternalControls | null>;
  disabled: boolean;
  onFormatApplied?: (format: IChatMarkdownBlockFormat) => void;
};
