import type * as React from 'react';

// syntax highlighting resolves to the concrete theme applied to token colors.
export type IResolvedSyntaxHighlightTheme = 'dark' | 'light';

// Prism style maps use token selectors as keys and React style objects as values.
export type ISyntaxHighlightStyle = Record<string, React.CSSProperties>;
