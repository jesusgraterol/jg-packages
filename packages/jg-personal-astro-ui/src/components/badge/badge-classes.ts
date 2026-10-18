// the look of each variant
const VARIANT_CLASSES = {
  default: 'border-primary bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-foreground',
  neutral: 'border-border bg-surface text-foreground',
  success: 'border-success/35 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  danger: 'border-danger/35 bg-danger/10 text-danger',
  outline: 'border-border-strong text-muted',
} as const;

// a badge's look
export type IBadgeVariant = keyof typeof VARIANT_CLASSES;

// the status dot before a badge's label, in the label's colour
export const BADGE_DOT_CLASSES = 'size-1.5 shrink-0 rounded-full bg-current';

/**
 * Builds a badge's classes from its variant and its font.
 * @param variant The look. Defaults to 'secondary'.
 * @param mono Whether the label is set in the mono font. Defaults to true.
 * @returns The classes, separated by spaces.
 */
export const buildBadgeClasses = (variant: IBadgeVariant = 'secondary', mono = true): string =>
  [
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap',
    mono ? 'font-mono' : '',
    VARIANT_CLASSES[variant],
  ]
    .filter(Boolean)
    .join(' ');
