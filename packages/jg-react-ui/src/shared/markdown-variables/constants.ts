// shared template-variable marker used by rendered markdown and editor decorations.
export const MARKDOWN_VARIABLE_DATA_SLOT = 'markdown-variable';

// fallback variable name used when a command has no selected text to normalize.
export const MARKDOWN_VARIABLE_FALLBACK_NAME = 'VARIABLE_NAME';

// variable highlights use foreground tokens so light and dark themes stay readable.
export const MARKDOWN_VARIABLE_HIGHLIGHT_CLASS_NAMES = [
  'rounded-sm',
  'bg-foreground/10',
  'px-1',
  'py-0.5',
  'font-mono',
  'font-semibold',
  'text-foreground',
] as const;

// uppercase template-token pattern shared by markdown preview and editing surfaces.
export const MARKDOWN_VARIABLE_PATTERN_SOURCE = String.raw`\{\{[A-Z][A-Z0-9_]*\}\}`;
