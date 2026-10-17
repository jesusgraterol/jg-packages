import { renderCodeWindowHeader } from '../components/code-block/code-window.ts';

// the parts of a hast element the plugin reads
type IHastElement = {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown> | undefined;
  children?: readonly unknown[] | undefined;
};

// the caption of a code block without a language
const DEFAULT_CAPTION = 'text';

/**
 * Reads a highlighted code block's language: the `data-language` Astro's highlighter sets, or the
 * `language-*` class of its `code` element.
 * @param pre The code block.
 * @returns The language, or 'text'.
 */
export const readCodeLanguage = (pre: IHastElement): string => {
  const language = pre.properties?.['dataLanguage'];
  if (typeof language === 'string' && language !== '') {
    return language;
  }
  const code = pre.children?.find(
    (child): child is IHastElement =>
      typeof child === 'object' &&
      child !== null &&
      (child as Partial<IHastElement>).tagName === 'code',
  );
  const classNames = code?.properties?.['className'];
  const languageClass = Array.isArray(classNames)
    ? classNames.find(
        (name): name is string => typeof name === 'string' && name.startsWith('language-'),
      )
    : undefined;
  return languageClass?.slice('language-'.length) || DEFAULT_CAPTION;
};

/**
 * A hast plugin for Astro's Markdown processor, Sätteri, that puts every code block in a code window,
 * like the code-block component's, with the language as its caption and a copy button. The prose
 * component loads what makes the copy buttons work, so render the Markdown inside it.
 * @example
 * // astro.config.ts
 * import { satteri } from '@astrojs/markdown-satteri';
 * import { defineConfig } from 'astro/config';
 * import { codeWindowPlugin } from 'jg-personal-astro-ui/code-window-plugin';
 *
 * export default defineConfig({
 *   markdown: { processor: satteri({ hastPlugins: [codeWindowPlugin] }) },
 * });
 */
export const codeWindowPlugin = {
  name: 'jg-code-window',
  element: {
    filter: ['pre'],
    // generic, so the window holds the processor's own node type, which its types require
    visit: <TNode extends IHastElement>(node: TNode) => ({
      type: 'element' as const,
      tagName: 'figure',
      properties: { className: ['jg-code-window'], dataCodeWindow: '' },
      children: [
        {
          type: 'raw' as const,
          value: renderCodeWindowHeader({ caption: readCodeLanguage(node) }),
        },
        node,
      ],
    }),
  },
};
