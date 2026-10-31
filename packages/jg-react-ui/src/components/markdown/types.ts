import type { Components, Options } from 'react-markdown';

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
};
