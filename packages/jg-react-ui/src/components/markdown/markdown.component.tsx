import { memo, useMemo } from 'react';
import type * as React from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from 'cnfast';

import { defaultMarkdownComponents } from './markdown-renderers.component.js';
import { MarkdownPreferencesProvider } from './markdown-preferences.context.js';
import type { IMarkdownProps } from './types.js';
import { highlightMarkdownVariablesRehypePlugin } from './utilities.js';

// stable parser props avoid reparsing unchanged documents after unrelated parent updates.
const MemoizedReactMarkdown = memo(ReactMarkdown);

/**
 * Renders trusted markdown text through the shared typography system.
 * @param props The markdown content and optional renderer overrides.
 * @returns A React element that renders the markdown document.
 * @example
 * import { createElement } from 'react';
 * import { Markdown } from 'jg-react-ui/components/markdown';
 * const example = createElement(Markdown, { children: '## Deployment\n\nReady to review.' });
 */
export const Markdown = ({
  children,
  className,
  components,
  prefersWrappedCode,
  rehypePlugins,
  remarkPlugins,
  shouldOpenLinksInNewTab = true,
  skipHtml = true,
  ...props
}: IMarkdownProps): React.ReactElement => {
  const resolvedComponents = useMemo(
    () => ({
      ...defaultMarkdownComponents,
      ...components,
    }),
    [components],
  );
  const resolvedRehypePlugins = useMemo(
    () => [...(rehypePlugins ?? []), highlightMarkdownVariablesRehypePlugin],
    [rehypePlugins],
  );
  const resolvedRemarkPlugins = useMemo(
    () => [remarkGfm, ...(remarkPlugins ?? [])],
    [remarkPlugins],
  );

  return (
    <MarkdownPreferencesProvider
      prefersWrappedCode={prefersWrappedCode}
      shouldOpenLinksInNewTab={shouldOpenLinksInNewTab}
    >
      <div
        data-slot="markdown"
        className={cn('text-foreground min-w-0 max-w-full wrap-anywhere', className)}
      >
        <MemoizedReactMarkdown
          {...props}
          components={resolvedComponents}
          rehypePlugins={resolvedRehypePlugins}
          remarkPlugins={resolvedRemarkPlugins}
          skipHtml={skipHtml}
        >
          {children}
        </MemoizedReactMarkdown>
      </div>
    </MarkdownPreferencesProvider>
  );
};
