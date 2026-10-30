import { cva } from 'class-variance-authority';

// drawer widths cover compact navigation and navigation with header actions.
/** Shared drawer styling contract.
 * @see drawerPopupVariants
 */
export const drawerPopupVariants = cva(
  'border-border h-full w-full overflow-hidden bg-background text-foreground shadow-raised outline-none transition-transform duration-300 ease-out data-swiping:select-none data-swiping:duration-0 motion-reduce:transition-none',
  {
    variants: {
      side: {
        left: 'border-r [transform:translateX(var(--drawer-swipe-movement-x))] data-ending-style:[transform:translateX(-100%)] data-starting-style:[transform:translateX(-100%)]',
        right:
          'border-l [transform:translateX(var(--drawer-swipe-movement-x))] data-ending-style:[transform:translateX(100%)] data-starting-style:[transform:translateX(100%)]',
      },
      size: {
        small: 'max-w-64',
        medium: 'max-w-72',
      },
    },
  },
);

// drawer density coordinates the fixed header with the scrolling body.
/** Shared drawer styling contract.
 * @see drawerHeaderVariants
 */
export const drawerHeaderVariants = cva(
  'relative grid shrink-0 gap-1 pt-[max(1rem,env(safe-area-inset-top))] pr-[calc(max(0.75rem,env(safe-area-inset-right))_+_2rem)] pl-[max(1rem,env(safe-area-inset-left))] text-left max-lg:pr-[calc(max(0.75rem,env(safe-area-inset-right))_+_3rem)]',
  {
    variants: {
      density: {
        comfortable: 'min-h-16 border-b border-border pb-4',
        compact: 'pb-2',
      },
    },
    defaultVariants: {
      density: 'comfortable',
    },
  },
);

// drawer body density preserves one coordinated gap below the fixed header.
/** Shared drawer styling contract.
 * @see drawerBodyVariants
 */
export const drawerBodyVariants = cva(
  'min-h-0 overflow-y-auto overscroll-contain pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))]',
  {
    variants: {
      density: {
        comfortable: 'pt-4',
        compact: 'pt-2',
      },
    },
    defaultVariants: {
      density: 'comfortable',
    },
  },
);
