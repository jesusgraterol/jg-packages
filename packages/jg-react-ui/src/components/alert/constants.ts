import { cva } from 'class-variance-authority';

// shared alert styles support both passive callouts and full-surface interactive alerts.
// a leading icon hangs in its own column, so every other child except the corner action shares the text edge.
/**
 * Composes the retained alert variant classes.
 * @example
 * import { alertVariants } from 'jg-react-ui/components/alert';
 * const styles = alertVariants({});
 */
export const alertVariants = cva(
  'relative block w-full rounded-lg border px-4 py-3 text-sm transition-[color,background-color,border-color,box-shadow] has-[>[data-slot=alert-action]]:pr-24 sm:has-[>[data-slot=alert-action]]:pr-28 has-[>svg]:[&>:not(svg):not([data-slot=alert-action])]:pl-7 [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:top-3.5 [&>svg]:left-4 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground dark:bg-border/30',
        destructive:
          'border-destructive/30 bg-destructive/5 text-foreground dark:border-destructive/40 dark:bg-destructive/10 [&>svg]:text-destructive',
      },
      interaction: {
        static: '',
        redirect:
          'cursor-pointer text-left no-underline outline-none focus-visible:border-transparent! focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:shadow-none aria-disabled:pointer-events-none aria-disabled:opacity-50',
        action:
          'cursor-pointer appearance-none text-left no-underline outline-none focus-visible:border-transparent! focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:shadow-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
      },
    },
    compoundVariants: [
      {
        variant: 'default',
        interaction: 'redirect',
        className: 'hover:bg-secondary/70 hover:text-foreground dark:hover:bg-border/55',
      },
      {
        variant: 'default',
        interaction: 'action',
        className: 'hover:bg-secondary/70 hover:text-foreground dark:hover:bg-border/55',
      },
      {
        variant: 'destructive',
        interaction: 'redirect',
        className: 'hover:bg-destructive/10 dark:hover:bg-destructive/15',
      },
      {
        variant: 'destructive',
        interaction: 'action',
        className: 'hover:bg-destructive/10 dark:hover:bg-destructive/15',
      },
    ],
    defaultVariants: {
      variant: 'default',
      interaction: 'static',
    },
  },
);
