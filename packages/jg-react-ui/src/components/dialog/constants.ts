import { cva } from 'class-variance-authority';

// mobile pages stay opaque; the root owns the returning-page snapshot on close.
const MOBILE_PAGE_DIALOG_TRANSITION_CLASS_NAME =
  'max-sm:will-change-transform max-sm:data-open:animate-in max-sm:data-open:duration-300 max-sm:data-open:ease-out max-sm:data-open:zoom-in-96';

// dialog panels use compact centered surfaces or page-like mobile layouts based on size.
/** Shared dialog styling contract.
 * @see dialogContentVariants
 */
export const dialogContentVariants = cva(
  'fixed z-50 border-border grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-background text-foreground outline-none will-change-[opacity] motion-reduce:transition-none motion-reduce:max-sm:data-open:animate-none motion-reduce:max-sm:data-closed:animate-none motion-reduce:sm:data-open:animate-none motion-reduce:sm:data-closed:animate-none',
  {
    variants: {
      size: {
        small:
          'inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-80 rounded-xl border shadow-raised data-open:animate-in data-closed:animate-out data-open:duration-300 data-closed:duration-200 data-open:ease-out data-closed:ease-in data-closed:fade-out-0 data-open:fade-in-0 data-open:slide-in-from-bottom-2 data-closed:slide-out-to-bottom-2 data-closed:zoom-out-95 data-open:zoom-in-95',
        medium: 'sm:max-w-2xl',
        large: 'sm:max-w-5xl',
      },
    },
    compoundVariants: [
      {
        size: ['medium', 'large'],
        className: `inset-0 h-dvh w-full max-w-none border-0 shadow-none ${MOBILE_PAGE_DIALOG_TRANSITION_CLASS_NAME} sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:rounded-xl sm:border sm:shadow-raised sm:data-open:animate-in sm:data-closed:animate-out sm:data-open:duration-300 sm:data-closed:duration-200 sm:data-open:ease-out sm:data-closed:ease-in sm:data-closed:fade-out-0 sm:data-open:fade-in-0 sm:data-open:slide-in-from-bottom-2 sm:data-closed:slide-out-to-bottom-2 sm:data-closed:zoom-out-95 sm:data-open:zoom-in-95`,
      },
    ],
  },
);

// dialog headers keep compact dialogs centered and page-like dialogs aligned with mobile back controls.
/** Shared dialog styling contract.
 * @see dialogHeaderVariants
 */
export const dialogHeaderVariants = cva('relative grid shrink-0', {
  variants: {
    size: {
      small: 'gap-2 px-5 pt-5 text-center',
      medium: '',
      large: '',
    },
  },
  compoundVariants: [
    {
      size: ['medium', 'large'],
      className:
        'gap-0 border-b border-border pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-4 pl-[max(0.5rem,env(safe-area-inset-left))] text-left sm:px-6 sm:py-4',
    },
  ],
});

// dialog bodies are the only regions that own vertical scrolling.
/** Shared dialog styling contract.
 * @see dialogBodyVariants
 */
export const dialogBodyVariants = cva('min-h-0 content-start overflow-y-auto overscroll-contain', {
  variants: {
    padding: {
      default: '',
      none: '',
    },
    size: {
      small: '',
      medium: '',
      large: '',
    },
  },
  compoundVariants: [
    {
      padding: 'default',
      size: 'small',
      className: 'px-5 py-5',
    },
    {
      padding: 'default',
      size: ['medium', 'large'],
      className:
        'pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-4 pl-[max(1rem,env(safe-area-inset-left))] sm:px-6 sm:py-6',
    },
  ],
  defaultVariants: {
    padding: 'default',
  },
});

// dialog footers keep terminal actions visible outside the scrolling body.
/** Shared dialog styling contract.
 * @see dialogFooterVariants
 */
export const dialogFooterVariants = cva('flex shrink-0 gap-2', {
  variants: {
    size: {
      small:
        'flex-col-reverse px-5 pb-5 *:w-full sm:flex-row sm:items-center sm:justify-end sm:[&>*:not(:only-child)]:w-auto sm:[&>*:first-child:not(:only-child)]:mr-auto',
      medium: '',
      large: '',
    },
  },
  compoundVariants: [
    {
      size: ['medium', 'large'],
      className:
        'flex-col-reverse border-t border-border pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] *:w-full sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-4 sm:[&>*:not(:only-child)]:w-auto sm:[&>*:first-child:not(:only-child)]:mr-auto',
    },
  ],
});
