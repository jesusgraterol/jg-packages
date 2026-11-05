import type * as React from 'react';

import type {
  IChatMarkdownBlockFormat,
  IChatMarkdownEditorInternalControls,
  IChatMarkdownEditorTool,
} from '../types.js';

// package-owned formatting props bind the compact menu to one live editor instance.
export type IChatMarkdownFormattingProps = {
  controlsRef: React.RefObject<IChatMarkdownEditorInternalControls | null>;
  disabled: boolean;
  supportedTools?: ReadonlyArray<IChatMarkdownEditorTool>;
  onFormatApplied?: (format: IChatMarkdownBlockFormat) => void;
};
