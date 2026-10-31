import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism/index.js';

import type { IResolvedSyntaxHighlightTheme, ISyntaxHighlightStyle } from './types.js';

// token colors retain the One theme hierarchy while meeting normal-text contrast thresholds.
const SYNTAX_COLOR_REPLACEMENTS = {
  dark: {
    'hsl(220, 14%, 71%)': 'var(--syntax-foreground, var(--foreground))',
    'hsl(220, 10%, 40%)': 'var(--syntax-token-comment, #8b93a1)',
    'hsl(29, 54%, 61%)': 'var(--syntax-token-constant, #d19a66)',
    'hsl(286, 60%, 67%)': 'var(--syntax-token-keyword, #c678dd)',
    'hsl(355, 65%, 65%)': 'var(--syntax-token-parameter, #e77b83)',
    'hsl(95, 38%, 62%)': 'var(--syntax-token-string, #98c379)',
    'hsl(207, 82%, 66%)': 'var(--syntax-token-function, #61afef)',
    'hsl(187, 47%, 55%)': 'var(--syntax-token-string-expression, #56b6c2)',
    'hsl(5, 48%, 51%)': 'var(--syntax-token-parameter, #e77b83)',
  },
  light: {
    'hsl(230, 8%, 24%)': 'var(--syntax-foreground, var(--foreground))',
    'hsl(230, 4%, 64%)': 'var(--syntax-token-comment, #5c6370)',
    'hsl(35, 99%, 36%)': 'var(--syntax-token-constant, #8a4b00)',
    'hsl(301, 63%, 40%)': 'var(--syntax-token-keyword, #8b1a89)',
    'hsl(5, 74%, 59%)': 'var(--syntax-token-parameter, #b82920)',
    'hsl(119, 34%, 47%)': 'var(--syntax-token-string, #2f6f31)',
    'hsl(221, 87%, 60%)': 'var(--syntax-token-function, #1f5fbf)',
    'hsl(198, 99%, 37%)': 'var(--syntax-token-string-expression, #006b8f)',
    'hsl(344, 84%, 43%)': 'var(--syntax-token-parameter, #b82920)',
  },
} satisfies Record<IResolvedSyntaxHighlightTheme, Record<string, string>>;

// semantic selectors whose role differs from the stock palette's shared color grouping.
const SYNTAX_SELECTOR_COLOR_ROLES: Record<string, string> = {
  punctuation: '--syntax-token-punctuation',
  url: '--syntax-token-link',
  '.language-javascript .token.template-string > .token.interpolation > .token.interpolation-punctuation.punctuation':
    '--syntax-token-string-expression',
};

/** Returns the shared syntax palette on the application's neutral code surface. */
const createSyntaxHighlightStyle = (
  theme: IResolvedSyntaxHighlightTheme,
): ISyntaxHighlightStyle => {
  const stockStyle = theme === 'dark' ? oneDark : oneLight;
  const replacements = SYNTAX_COLOR_REPLACEMENTS[theme] as Record<string, string>;
  return {
    table: { display: 'inline' },
    ...Object.fromEntries(
      Object.entries(stockStyle).map(([selector, tokenStyle]) => [
        selector,
        {
          ...tokenStyle,
          ...(typeof tokenStyle.color === 'string' && {
            color: SYNTAX_SELECTOR_COLOR_ROLES[selector]
              ? `var(${SYNTAX_SELECTOR_COLOR_ROLES[selector]}, ${replacements[tokenStyle.color] ?? tokenStyle.color})`
              : (replacements[tokenStyle.color] ?? tokenStyle.color),
          }),
          ...(selector.startsWith('pre[') && { background: 'var(--background)' }),
        },
      ]),
    ),
  };
};

// two immutable-by-convention maps avoid rebuilding every token selector during rendering.
const SYNTAX_HIGHLIGHT_STYLES = {
  light: createSyntaxHighlightStyle('light'),
  dark: createSyntaxHighlightStyle('dark'),
};

/** Returns the stable token style map for the resolved document theme. */
export const getSyntaxHighlightStyle = (
  theme: IResolvedSyntaxHighlightTheme,
): ISyntaxHighlightStyle => SYNTAX_HIGHLIGHT_STYLES[theme];
