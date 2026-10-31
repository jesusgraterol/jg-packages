import { lazy, Suspense } from 'react';
import type * as React from 'react';
import { cn } from 'cnfast';

import { MARKDOWN_EDITOR_LAYOUTS } from './constants.js';
import { useMarkdownEditorLayout } from './markdown-editor-layout.hook.js';
import { MarkdownEditorLoadingFallback } from './markdown-editor-loading-fallback.component.js';
import type { IMarkdownEditorProps, IMarkdownEditorVariantProps } from './types.js';

// each responsive implementation is downloaded only when the container selects it.
const LazyCompactMarkdownEditor = lazy(async () => {
  const module = await import('./compact-markdown-editor/index.js');

  return { default: module.CompactMarkdownEditor };
});

const LazyWideMarkdownEditor = lazy(async () => {
  const module = await import('./wide-markdown-editor/index.js');

  return { default: module.WideMarkdownEditor };
});

/**
 * Selects the compact or wide markdown editor from its available container width.
 * @param props The controlled editor props and optional responsive layout override.
 * @returns A React element that renders the selected editor implementation.
 * @example
 * import { createElement } from 'react';
 * import { MarkdownEditor } from 'jg-react-ui/components/markdown-editor';
 * const editor = createElement(MarkdownEditor, { value: '## Notes', onChange: () => {} });
 */
export const MarkdownEditor = ({
  className,
  layout = MARKDOWN_EDITOR_LAYOUTS.Auto,
  ...editorProps
}: IMarkdownEditorProps): React.ReactElement => {
  const { containerRef, resolvedLayout } = useMarkdownEditorLayout(layout);
  const variantProps: IMarkdownEditorVariantProps = editorProps;

  return (
    <div
      ref={containerRef}
      className={cn('w-full max-w-full min-w-0', className)}
      data-markdown-editor-layout={resolvedLayout ?? 'pending'}
      data-slot="markdown-editor-container"
    >
      <Suspense fallback={<MarkdownEditorLoadingFallback {...variantProps} />}>
        {resolvedLayout === MARKDOWN_EDITOR_LAYOUTS.Wide ? (
          <LazyWideMarkdownEditor {...variantProps} />
        ) : resolvedLayout === MARKDOWN_EDITOR_LAYOUTS.Compact ? (
          <LazyCompactMarkdownEditor {...variantProps} />
        ) : (
          <MarkdownEditorLoadingFallback {...variantProps} />
        )}
      </Suspense>
    </div>
  );
};
