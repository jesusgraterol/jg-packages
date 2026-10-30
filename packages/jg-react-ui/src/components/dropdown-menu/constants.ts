import { cva } from 'class-variance-authority';

// dropdown menu item variants centralize shared inset and destructive row styling.
export const dropdownMenuItemVariants = cva(
  'pointer-coarse:min-h-11 pointer-coarse:text-base motion-reduce:transition-none relative flex wrap-anywhere cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  {
    variants: {
      inset: {
        false: '',
        true: 'pl-8',
      },
      variant: {
        default:
          'data-[highlighted]:bg-secondary data-[highlighted]:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground',
        destructive:
          'text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive data-popup-open:bg-destructive/10 data-popup-open:text-destructive dark:data-[highlighted]:bg-destructive/20 dark:data-popup-open:bg-destructive/20',
      },
    },
    defaultVariants: {
      inset: false,
      variant: 'default',
    },
  },
);
