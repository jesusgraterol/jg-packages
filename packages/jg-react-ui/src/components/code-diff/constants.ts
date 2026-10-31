import type { ReactDiffViewerProps } from 'react-diff-viewer-continued';
import type { IBreakpoint } from 'jg-react';

// code diffs switch to split view only once the layout reaches the desktop breakpoint.
export const DEFAULT_RESPONSIVE_BREAKPOINT = 'lg' satisfies IBreakpoint;

// bound synchronous computation by both text size and total lines, including disjoint revisions.
export const CODE_DIFF_SYNC_MAX_CHARACTERS = 8192;
export const CODE_DIFF_SYNC_MAX_LINES = 128;

/** Registered diff languages; text keeps literal content.
 * @see CodeDiff
 */
export const CODE_DIFF_LANGUAGES = {
  bash: 'bash',
  json: 'json',
  jsx: 'jsx',
  markdown: 'markdown',
  python: 'python',
  text: 'text',
  tsx: 'tsx',
  typescript: 'typescript',
} as const;

// shared style overrides align the third-party diff viewer with consumer surface and typography tokens.
export const DEFAULT_CODE_DIFF_STYLES: NonNullable<ReactDiffViewerProps['styles']> = {
  variables: {
    light: {
      diffViewerBackground: 'var(--background)',
      diffViewerColor: 'var(--foreground)',
      diffViewerTitleBackground: 'var(--secondary)',
      diffViewerTitleColor: 'var(--foreground)',
      diffViewerTitleBorderColor: 'var(--border)',
      addedBackground: 'color-mix(in srgb, var(--chart-1) 12%, var(--background))',
      addedColor: 'var(--foreground)',
      removedBackground: 'color-mix(in srgb, var(--destructive) 8%, var(--background))',
      removedColor: 'var(--foreground)',
      changedBackground: 'color-mix(in srgb, var(--chart-1) 8%, var(--background))',
      wordAddedBackground: 'color-mix(in srgb, var(--chart-1) 26%, var(--background))',
      wordRemovedBackground: 'color-mix(in srgb, var(--destructive) 20%, var(--background))',
      addedGutterBackground: 'color-mix(in srgb, var(--chart-1) 20%, var(--background))',
      removedGutterBackground: 'color-mix(in srgb, var(--destructive) 14%, var(--background))',
      gutterBackground: 'var(--secondary)',
      gutterBackgroundDark: 'color-mix(in oklch, var(--foreground) 6%, var(--secondary))',
      gutterColor: 'var(--secondary-foreground)',
      addedGutterColor: 'var(--foreground)',
      removedGutterColor: 'color-mix(in srgb, var(--destructive) 68%, var(--foreground))',
      highlightBackground: 'color-mix(in srgb, var(--chart-1) 10%, var(--background))',
      highlightGutterBackground: 'color-mix(in srgb, var(--chart-1) 16%, var(--background))',
      codeFoldGutterBackground: 'var(--secondary)',
      codeFoldBackground: 'var(--secondary)',
      codeFoldContentColor:
        'color-mix(in oklch, var(--secondary-foreground) 78%, var(--foreground))',
      emptyLineBackground: 'color-mix(in oklch, var(--secondary) 55%, var(--background))',
    },
    dark: {
      diffViewerBackground: 'var(--background)',
      diffViewerColor: 'var(--foreground)',
      diffViewerTitleBackground: 'var(--secondary)',
      diffViewerTitleColor: 'var(--foreground)',
      diffViewerTitleBorderColor: 'var(--border)',
      addedBackground: 'color-mix(in srgb, var(--chart-1) 22%, var(--background))',
      addedColor: 'var(--foreground)',
      removedBackground: 'color-mix(in srgb, var(--destructive) 12%, var(--background))',
      removedColor: 'var(--foreground)',
      changedBackground: 'color-mix(in srgb, var(--chart-1) 12%, var(--background))',
      wordAddedBackground: 'color-mix(in srgb, var(--chart-1) 40%, var(--background))',
      wordRemovedBackground: 'color-mix(in srgb, var(--destructive) 28%, var(--background))',
      addedGutterBackground: 'color-mix(in srgb, var(--chart-1) 30%, var(--background))',
      removedGutterBackground: 'color-mix(in srgb, var(--destructive) 20%, var(--background))',
      gutterBackground: 'var(--secondary)',
      gutterBackgroundDark: 'color-mix(in oklch, var(--foreground) 8%, var(--secondary))',
      gutterColor: 'var(--secondary-foreground)',
      addedGutterColor: 'var(--foreground)',
      removedGutterColor: 'var(--destructive)',
      highlightBackground: 'color-mix(in srgb, var(--chart-1) 18%, var(--background))',
      highlightGutterBackground: 'color-mix(in srgb, var(--chart-1) 26%, var(--background))',
      codeFoldGutterBackground: 'var(--secondary)',
      codeFoldBackground: 'var(--secondary)',
      codeFoldContentColor: 'var(--secondary-foreground)',
      emptyLineBackground: 'color-mix(in oklch, var(--secondary) 55%, var(--background))',
    },
  },
  diffContainer: {
    background: 'var(--background)',
    minWidth: '100%',
    overflowX: 'visible',
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    border: 0,
    borderRadius: 0,
    boxShadow: 'none',
    fontSize: 13,
  },
  summary: {
    '@media (any-pointer: coarse)': { minHeight: 44 },
    borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-sans, sans-serif)',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.01em',
    minHeight: 40,
    padding: '0.625rem 0.75rem',
  },
  titleBlock: {
    alignItems: 'center',
    display: 'flex',
    fontFamily: 'var(--font-sans, sans-serif)',
    fontSize: 12,
    fontWeight: 600,
    height: 'auto',
    letterSpacing: '0.01em',
    minHeight: 40,
    padding: '0.625rem 0.875rem',
  },
  line: {
    fontSize: 13,
  },
  content: {
    padding: '0.0625rem 0',
  },
  lineContent: {
    minWidth: 0,
  },
  contentText: {
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.8125rem',
    lineHeight: 1.75,
  },
  gutter: {
    borderRight: '1px solid color-mix(in oklch, var(--border) 72%, transparent)',
    minWidth: 56,
    width: 56,
    padding: '0 0.75rem',
    pre: {
      opacity: 1,
    },
  },
  lineNumber: {
    fontSize: 11,
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  marker: {
    color: 'var(--foreground)',
    fontWeight: 700,
    paddingLeft: 8,
    paddingRight: 8,
    textAlign: 'center',
    width: 32,
  },
  wordDiff: {
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  wordAdded: {
    borderRadius: 3,
  },
  wordRemoved: {
    borderRadius: 3,
  },
  codeFoldGutter: {
    borderRight: '1px solid color-mix(in oklch, var(--border) 72%, transparent)',
  },
  codeFoldContentContainer: {
    padding: 0,
  },
  codeFoldExpandButton: {
    '@media (any-pointer: coarse)': { minHeight: 44 },
    display: 'block',
    padding: '0.625rem 0.875rem',
    textAlign: 'left',
    width: '100%',
    ':focus-visible': {
      outline: '2px solid var(--foreground)',
      outlineOffset: -2,
    },
  },
  codeFold: {
    borderBottom: '1px solid color-mix(in oklch, var(--border) 72%, transparent)',
    borderTop: '1px solid color-mix(in oklch, var(--border) 72%, transparent)',
  },
  allExpandButton: {
    border: '1px solid transparent',
    borderRadius: 'var(--radius-sm)',
    '@media (any-pointer: coarse)': { minWidth: 44, minHeight: 44 },
    height: 24,
    padding: 4,
    width: 24,
    ':hover': {
      background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
    },
    ':focus-visible': {
      borderColor: 'var(--foreground)',
      outline: '2px solid var(--foreground)',
      outlineOffset: 2,
    },
  },
};
