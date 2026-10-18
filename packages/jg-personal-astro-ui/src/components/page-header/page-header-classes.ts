// where an inner page's header sits: at the start of the page column, or centered over it
export type IPageHeaderAlign = 'center' | 'start';

// the classes of each part of an inner page's header
export type IPageHeaderClasses = {
  container: string;
  lede: string;
  row: string;
};

/**
 * Builds the classes of an inner page's header. Centered, its title row, its text, and its lede
 * sit in the middle of the page column; its breadcrumb is centered through its own `align`.
 * @param align Where the header sits. Defaults to 'start'.
 * @returns The classes of the container, the row holding the mark and the title, and the lede.
 */
export const buildPageHeaderClasses = (align: IPageHeaderAlign = 'start'): IPageHeaderClasses =>
  align === 'center'
    ? {
        container: 'jg-container pt-8 pb-12 text-center sm:pt-10 sm:pb-16',
        row: 'flex items-center justify-center gap-4 sm:gap-5',
        lede: 'lede mx-auto mt-5',
      }
    : {
        container: 'jg-container pt-8 pb-12 sm:pt-10 sm:pb-16',
        row: 'flex items-center gap-4 sm:gap-5',
        lede: 'lede mt-5',
      };
