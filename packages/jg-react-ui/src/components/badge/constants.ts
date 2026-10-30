import { cva } from 'class-variance-authority';

// shared badge styles follow the shadcn badge API while using consumer theme tokens.
// Oklab preserves the destructive hue when mixing with near-neutral foreground colors.
// warning mixes the light amber toward the foreground so its text keeps contrast on light surfaces.
/**
 * Composes the retained badge variant classes.
 * @example
 * import { badgeVariants } from 'jg-react-ui/components/badge';
 * const styles = badgeVariants({});
 */
export const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,text-decoration-color] outline-none select-none focus-visible:border-transparent! focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground [a&]:hover:bg-primary/80 dark:[a&]:hover:bg-primary/30',
        secondary: 'bg-secondary text-foreground [a&]:hover:bg-secondary/70',
        destructive:
          'bg-destructive/10 text-[color:color-mix(in_oklab,var(--destructive)_85%,var(--foreground))] dark:text-[color:color-mix(in_oklab,var(--destructive)_60%,var(--foreground))] focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/20 dark:[a&]:hover:bg-destructive/30',
        warning:
          'border-chart-2/40 bg-chart-2/10 text-[color:color-mix(in_oklab,var(--chart-2)_45%,var(--foreground))] dark:bg-chart-2/15 dark:text-chart-2 [a&]:hover:bg-chart-2/20',
        success:
          'border-chart-1/30 bg-chart-1/10 text-chart-1 dark:bg-chart-1/15 [a&]:hover:bg-chart-1/20',
        outline:
          'border-border bg-background text-foreground [a&]:hover:bg-secondary [a&]:hover:text-foreground dark:bg-border/30 dark:[a&]:hover:bg-border/50',
        ghost: '[a&]:hover:bg-secondary [a&]:hover:text-foreground dark:[a&]:hover:bg-secondary/50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
