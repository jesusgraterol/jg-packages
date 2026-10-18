// the look of each variant
const VARIANT_CLASSES = {
  default:
    'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:border-primary/90',
  outline: 'border-border-strong bg-transparent text-foreground hover:bg-secondary',
  secondary: 'border-transparent bg-secondary text-foreground hover:bg-secondary/70',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-secondary hover:text-foreground',
  destructive: 'border-danger bg-danger text-background hover:bg-danger/90',
  link: 'border-transparent bg-transparent text-foreground underline-offset-4 hover:underline',
  // a light pill for the inverse surface, with a light focus ring that shows on it
  inverse:
    'border-inverse-foreground bg-inverse-foreground text-inverse hover:bg-inverse-foreground/90 hover:border-inverse-foreground/90 focus-visible:outline-inverse-foreground',
} as const;

// the height, gap, and text of each size; touch keeps a 44 px target
const SIZE_CLASSES = {
  xs: 'min-h-7 gap-1 text-xs',
  sm: 'min-h-9 gap-1.5 text-sm',
  default: 'min-h-11 gap-2 text-sm',
  lg: 'min-h-12 gap-2 text-base',
  icon: 'size-9 justify-center',
  touch: 'size-11 justify-center',
} as const;

// the side padding of each size, which the link variant leaves out, so its text lines up with the
// text around it
const SIZE_PADDING: Record<IButtonSize, string> = {
  xs: 'px-2.5',
  sm: 'px-3.5',
  default: 'px-4.5',
  lg: 'px-6',
  icon: '',
  touch: '',
};

// a button's look
export type IButtonVariant = keyof typeof VARIANT_CLASSES;

// a button's height and padding
export type IButtonSize = keyof typeof SIZE_CLASSES;

/**
 * Builds a button's classes from its size and variant. The padding comes from the size, except for
 * the link variant, which has none; a size and a variant never set the same property, so neither
 * depends on the order Tailwind writes them in.
 * @param size The size.
 * @param variant The variant.
 * @param className Classes the page adds, such as for layout.
 * @returns The classes, separated by spaces.
 */
export const buildButtonClasses = (
  size: IButtonSize,
  variant: IButtonVariant,
  className?: string,
): string =>
  [
    'inline-flex shrink-0 items-center justify-center rounded-full border font-semibold no-underline transition-colors disabled:pointer-events-none disabled:opacity-50',
    SIZE_CLASSES[size],
    variant === 'link' ? '' : SIZE_PADDING[size],
    VARIANT_CLASSES[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ');
