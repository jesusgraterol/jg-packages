import { isValidElement } from 'react';
import type * as React from 'react';

import { codeBlockLanguageLabels } from './constants.js';

const proseLanguages = new Set(['text', 'txt', 'plaintext', 'markdown', 'md', 'mdx']);
const proseFileExtension = /\.(?:md|markdown|mdx|txt|text)$/i;

/**
 * Returns whether declared source metadata identifies prose that should wrap by default.
 * @param filePath An optional repository path.
 * @param language An optional declared syntax identifier.
 * @returns Whether the source should wrap automatically.
 * @example
 * import { isCodeBlockProse } from 'jg-react-ui/components/typography';
 * isCodeBlockProse('README.md'); // => true
 */
export const isCodeBlockProse = (filePath?: string, language?: string): boolean =>
  proseFileExtension.test(filePath ?? '') ||
  proseLanguages.has(language?.trim().toLowerCase() ?? '');

/**
 * Extracts plain code text from React-rendered code block children.
 * @param node The code block child node.
 * @returns The concatenated code text.
 */
export const extractCodeText = (node: React.ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (Array.isArray(node)) {
    return node.map(extractCodeText).join('');
  }

  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractCodeText(node.props.children);
  }

  return '';
};

/**
 * Resolves a syntax identifier into the label displayed in the code block header.
 * @param language The syntax identifier passed to the highlighter.
 * @returns A known friendly label or the original identifier.
 */
export const resolveCodeBlockLanguageLabel = (language: string): string => {
  if (language.startsWith('diff-')) {
    const sourceLanguage = language.slice(5);
    return `Diff (${codeBlockLanguageLabels[sourceLanguage] ?? sourceLanguage})`;
  }

  return codeBlockLanguageLabels[language] ?? language;
};
