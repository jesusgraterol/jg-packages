import { lazy, Suspense } from 'react';
import type * as React from 'react';

import { MarkdownEditorLoadingFallback } from '../markdown-editor-loading-fallback.component.js';
import { useIsDarkMode } from '../theme.hook.js';
import type { IMarkdownEditorVariantProps } from '../types.js';

// lazy editor implementation keeps Milkdown and Crepe out of screens that never mount the editor.
const LazyWideMarkdownEditorContent = lazy(async () => {
  const module = await import('../markdown-editor-content.component.js');

  return { default: module.MarkdownEditorContent };
});

/**
 * Renders the established wide markdown editor with its existing Milkdown configuration.
 * @param props The controlled editor props.
 * @returns A React element that renders the wide editor.
 * @example
 * import { createElement } from 'react';
 * import { WideMarkdownEditor } from 'jg-react-ui/components/markdown-editor';
 * const editor = createElement(WideMarkdownEditor, { value: '## Notes', onChange: () => {} });
 */
export const WideMarkdownEditor = (props: IMarkdownEditorVariantProps): React.ReactElement => {
  const isDarkMode = useIsDarkMode();

  return (
    <Suspense fallback={<MarkdownEditorLoadingFallback {...props} />}>
      <LazyWideMarkdownEditorContent
        {...props}
        isDarkMode={isDarkMode}
      />
    </Suspense>
  );
};
