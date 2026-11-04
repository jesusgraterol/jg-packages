import type { Components, Options } from 'react-markdown';

/** How many levels Markdown's headings move down, so they nest under the page's own headings.
 * @see Markdown
 */
export type IMarkdownHeadingLevelOffset = 0 | 1 | 2 | 3 | 4 | 5;

/** Markdown props keep the wrapper controlled while allowing component overrides.
 * @see Markdown
 */
export type IMarkdownProps = Omit<
  Options,
  'children' | 'components' | 'rehypePlugins' | 'remarkPlugins'
> & {
  children: string;
  className?: string | undefined;
  components?: Components | undefined;
  prefersWrappedCode?: boolean | undefined;
  rehypePlugins?: NonNullable<Options['rehypePlugins']> | undefined;
  remarkPlugins?: NonNullable<Options['remarkPlugins']> | undefined;
  // default-rendered web links open in secure new tabs; pass false to retain same-tab navigation.
  shouldOpenLinksInNewTab?: boolean | undefined;
  // lowers every heading by this many levels, to h6 at most, such as 1 under a page's h1. Defaults to 0
  headingLevelOffset?: IMarkdownHeadingLevelOffset | undefined;
};
