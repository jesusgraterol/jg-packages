import { lazy, Suspense } from 'react';
import type * as React from 'react';

import { MarkdownEditorLoadingFallback } from '../markdown-editor-loading-fallback.component.js';
import { useIsDarkMode } from '../theme.hook.js';
import type { IMarkdownEditorVariantProps } from '../types.js';

// compact mode reuses the proven editor behavior while loading only when selected.
const LazyCompactMarkdownEditorContent = lazy(async () => {
  const module = await import('../markdown-editor-content.component.js');

  return { default: module.MarkdownEditorContent };
});

/**
 * Renders the compact markdown editor with controls scoped to narrow containers.
 * @param props The controlled editor props.
 * @returns A React element that renders the compact editor.
 * @example
 * import { createElement } from 'react';
 * import { CompactMarkdownEditor } from 'jg-react-ui/components/markdown-editor';
 * const editor = createElement(CompactMarkdownEditor, { value: '## Notes', onChange: () => {} });
 */
export const CompactMarkdownEditor = (props: IMarkdownEditorVariantProps): React.ReactElement => {
  const isDarkMode = useIsDarkMode();

  return (
    <div
      className="w-full max-w-full min-w-0"
      data-markdown-editor-layout="compact"
    >
      <Suspense fallback={<MarkdownEditorLoadingFallback {...props} />}>
        <LazyCompactMarkdownEditorContent
          {...props}
          isDarkMode={isDarkMode}
        />
      </Suspense>
    </div>
  );
};
