import { PrismLight } from 'react-syntax-highlighter';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash.js';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json.js';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx.js';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown.js';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python.js';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx.js';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript.js';

import {
  getSyntaxHighlightStyle,
  useResolvedSyntaxHighlightTheme,
  type IResolvedSyntaxHighlightTheme,
  type ISyntaxHighlightStyle,
} from '../../shared/syntax-highlighting/index.js';

// code diff highlight themes follow the surrounding app theme.
type IResolvedCodeDiffCodeTheme = IResolvedSyntaxHighlightTheme;

// code diff Prism style maps carry token selector styles before diff-specific normalization.
export type ICodeDiffHighlightStyle = ISyntaxHighlightStyle;

// code diff syntax highlighter registers the common grammars used by app-ui code surfaces.
export const CodeDiffSyntaxHighlighter = PrismLight;

CodeDiffSyntaxHighlighter.registerLanguage('bash', bash);
CodeDiffSyntaxHighlighter.registerLanguage('json', json);
CodeDiffSyntaxHighlighter.registerLanguage('jsx', jsx);
CodeDiffSyntaxHighlighter.registerLanguage('markdown', markdown);
CodeDiffSyntaxHighlighter.registerLanguage('python', python);
CodeDiffSyntaxHighlighter.registerLanguage('tsx', tsx);
CodeDiffSyntaxHighlighter.registerLanguage('typescript', typescript);

/**
 * Returns the Prism style map for the resolved code diff theme.
 * @param resolvedCodeDiffCodeTheme The active code diff theme.
 * @returns A Prism style map with code diff token layout fixes applied.
 */
export const getCodeDiffHighlightStyle = (
  resolvedCodeDiffCodeTheme: IResolvedCodeDiffCodeTheme,
): ICodeDiffHighlightStyle => {
  const syntaxStyle = getSyntaxHighlightStyle(resolvedCodeDiffCodeTheme);
  const syntaxColorWeight = resolvedCodeDiffCodeTheme === 'dark' ? 60 : 80;
  const baseColor = syntaxStyle['code[class*="language-"]']?.color;
  return Object.fromEntries(
    Object.entries(syntaxStyle).map(([selector, tokenStyle]) => [
      selector,
      {
        ...tokenStyle,
        ...(typeof tokenStyle.color === 'string' && {
          color:
            tokenStyle.color === baseColor
              ? 'var(--foreground)'
              : `color-mix(in srgb, ${tokenStyle.color} ${syntaxColorWeight}%, var(--foreground))`,
        }),
      },
    ]),
  );
};

/**
 * Tracks the active code diff syntax theme across document and system theme changes.
 * @returns The resolved code diff theme for the current browser environment.
 */
export const useResolvedCodeDiffCodeTheme = (): IResolvedCodeDiffCodeTheme =>
  useResolvedSyntaxHighlightTheme();
