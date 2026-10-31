// text-link variants distinguish inline prose from standalone text actions.
export const TEXT_LINK_VARIANT_CLASS_NAMES = {
  action: 'inline-flex w-fit items-center gap-2 text-sm font-semibold',
  prose:
    'text-primary font-medium underline underline-offset-4 dark:text-primary-foreground dark:hover:text-primary-foreground/80',
} as const;
