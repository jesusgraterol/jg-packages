// where a section's header sits: at the start of its column, or centered over it
export type ISectionAlign = 'center' | 'start';

// how a section's header is laid out: stacked, or split into the eyebrow beside the title and lede
export type ISectionLayout = 'split' | 'stacked';

// default sections inherit their context; inverse sections own a dark surface in either theme
export type ISectionTone = 'default' | 'inverse';

// what buildSectionClasses needs
export type ISectionClassOptions = {
  // centers a stacked header; a split header always starts at the column's edge. Defaults to 'start'
  align?: ISectionAlign | undefined;
  // draws a hairline under the section. Defaults to true
  border?: boolean | undefined;
  // defaults to 'stacked'
  layout?: ISectionLayout | undefined;
  // the page column, or the narrower reading column. Defaults to 'page'
  width?: 'page' | 'prose' | undefined;
  tone?: ISectionTone | undefined;
};

// the classes of each part of a section
export type ISectionClasses = {
  container: string;
  header: string;
  lede: string;
  root: string;
  title: string;
};

/**
 * Builds the classes of a home page section. A split header puts the eyebrow in a narrow column
 * beside the title and lede from the `lg` breakpoint, and stacks them on narrower screens.
 * @param options The alignment, border, layout, and width.
 * @returns The classes of the section, its container, its header, its title, and its lede.
 */
export const buildSectionClasses = ({
  align = 'start',
  border = true,
  layout = 'stacked',
  width = 'page',
  tone = 'default',
}: ISectionClassOptions = {}): ISectionClasses => {
  const isCentered = layout === 'stacked' && align === 'center';
  return {
    root: [
      'jg-section-space scroll-mt-16',
      border && 'border-b border-border',
      tone === 'inverse' && 'jg-section-inverse',
    ]
      .filter(Boolean)
      .join(' '),
    container: width === 'prose' ? 'jg-container-prose' : 'jg-container',
    header:
      layout === 'split'
        ? 'grid gap-4 lg:grid-cols-[0.42fr_1fr] lg:gap-x-10'
        : isCentered
          ? 'mx-auto max-w-3xl text-center'
          : 'max-w-3xl',
    title: layout === 'split' ? 'section-title' : 'section-title mt-4',
    lede: isCentered ? 'lede mx-auto mt-5' : 'lede mt-5',
  };
};
