// the classes of a brand logo's text
export type IBrandLogoClasses = {
  name: string;
  tagline: string;
};

/**
 * Builds the classes of a brand logo's text. With a tagline, the name and the tagline stack in two
 * lines, the tagline small, mono, and muted.
 * @param hasTagline Whether the logo shows a tagline.
 * @returns The classes of the name and the tagline.
 */
export const buildBrandLogoClasses = (hasTagline: boolean): IBrandLogoClasses => ({
  name: hasTagline ? 'block truncate text-base leading-none' : 'truncate text-base',
  tagline:
    'mt-1 block truncate font-mono text-[0.62rem] font-bold tracking-[0.11em] text-muted uppercase',
});
