import { cva } from 'class-variance-authority';

import type { IButtonBadgeLocation, IButtonBadgeTheme } from './types.js';

// button badge counts collapse at this value unless consumers provide a custom maxValue.
export const BUTTON_BADGE_DEFAULT_MAX_VALUE = 9;

// button badge base classes keep count badges compact, theme-aware, and non-interactive.
export const BUTTON_BADGE_CLASS_NAME =
  'pointer-events-none absolute z-10 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.6875rem] leading-none font-bold shadow-xs ring-2 ring-background';

// location classes anchor the badge to the requested button corner.
export const BUTTON_BADGE_LOCATION_CLASS_NAMES = {
  'bottom-left': '-bottom-3 -left-3',
  'bottom-right': '-right-3 -bottom-3',
  'top-left': '-top-3 -left-3',
  'top-right': '-top-1 -right-2.5 sm:-top-2.5',
} satisfies Record<IButtonBadgeLocation, string>;

// theme classes let consumers align count badges with the surrounding action semantics.
export const BUTTON_BADGE_THEME_CLASS_NAMES = {
  destructive: 'bg-destructive text-primary-foreground',
  outline: 'border-border bg-background text-foreground',
  primary: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-foreground',
} satisfies Record<IButtonBadgeTheme, string>;

/**
 * Builds the retained button variant and size classes.
 * @param props The variant, size, and optional extra classes.
 * @returns The composed button classes.
 * @example
 * import { buttonVariants } from 'jg-react-ui/components/button';
 * const classes = buttonVariants({ variant: 'outline', size: 'touch' });
 */
export const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all motion-reduce:transition-none outline-none select-none focus-visible:border-transparent! focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:shadow-none motion-safe:not-disabled:not-aria-disabled:active:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary/80 dark:not-disabled:not-aria-disabled:hover:bg-primary/30',
        outline:
          'border-border bg-background not-disabled:not-aria-disabled:hover:bg-secondary not-disabled:not-aria-disabled:hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-foreground dark:bg-border/30 dark:not-disabled:not-aria-disabled:hover:bg-border/50',
        secondary:
          'bg-secondary text-foreground not-disabled:not-aria-disabled:hover:bg-secondary/70 aria-expanded:bg-secondary aria-expanded:text-foreground',
        ghost:
          'not-disabled:not-aria-disabled:hover:bg-secondary not-disabled:not-aria-disabled:hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-foreground dark:not-disabled:not-aria-disabled:hover:bg-secondary/50',
        destructive:
          'bg-destructive/10 text-[color:color-mix(in_oklab,var(--destructive)_80%,var(--foreground))] not-disabled:not-aria-disabled:hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:text-[color:color-mix(in_oklab,var(--destructive)_60%,var(--foreground))] dark:not-disabled:not-aria-disabled:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
        link: 'text-primary underline-offset-4 not-disabled:not-aria-disabled:hover:underline dark:text-primary-foreground dark:not-disabled:not-aria-disabled:hover:text-primary-foreground/80',
      },
      size: {
        default:
          'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        touch:
          'min-h-11 pointer-coarse:min-w-11 gap-1.5 px-3 py-2 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 sm:h-8 sm:pointer-fine:min-h-0 sm:px-2.5 sm:py-0 sm:has-data-[icon=inline-end]:pr-2 sm:has-data-[icon=inline-start]:pl-2',
        'touch-lg':
          'min-h-12 gap-2 px-4 py-3 text-base has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5',
        xs: "h-6 gap-1 rounded-md px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-md px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        icon: 'size-8',
        'icon-touch': 'size-11 sm:pointer-fine:size-8',
        inline: 'h-auto gap-1 p-0',
        'icon-xs':
          "size-6 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-7 rounded-md in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
