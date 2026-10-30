import { cva } from 'class-variance-authority';

/** Builds statement typography independently from its semantic heading level.
 * @param props The selected heading role and additional classes.
 * @returns The heading classes.
 * @example
 * import { headingVariants } from 'jg-react-ui/components/typography';
 * const classes = headingVariants({ role: 'section' });
 */
export const headingVariants = cva('wrap-break-word font-bold text-balance', {
  variants: {
    role: {
      display: 'text-5xl leading-[1.1] tracking-[-0.045em] sm:text-6xl xl:text-7xl',
      'public-page': 'text-4xl leading-[1.15] tracking-[-0.04em] sm:text-5xl lg:text-6xl',
      section: 'text-3xl leading-[1.2] tracking-tight sm:text-4xl lg:text-5xl',
      'product-page': 'text-3xl leading-[1.2] tracking-normal sm:text-4xl',
      'product-statement': 'text-5xl leading-[1.1] tracking-tight xl:text-6xl 2xl:text-7xl',
    },
  },
});

// heading class names encode the supported typographic heading scale.
export const headingClassNames = {
  1: `scroll-m-20 text-center ${headingVariants({ role: 'product-page' })}`,
  2: 'scroll-m-20 wrap-break-word border-b pb-2 text-2xl font-semibold tracking-normal transition-colors motion-reduce:transition-none sm:text-3xl',
  3: 'mt-8 scroll-m-20 wrap-break-word text-xl font-semibold tracking-normal sm:text-2xl',
  4: 'mt-8 scroll-m-20 wrap-break-word text-lg font-semibold tracking-normal sm:text-xl',
  5: 'mt-8 scroll-m-20 wrap-break-word text-base font-semibold tracking-normal sm:text-lg',
} as const;
