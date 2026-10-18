// the attributes of a link card's title link
export type ILinkCardLinkAttributes = {
  rel?: 'noreferrer' | undefined;
  target?: '_blank' | undefined;
};

/**
 * Builds the attributes of a link card's title link: a link to another site opens in a new tab,
 * without a referrer.
 * @param external Whether the card links to another site.
 * @returns The target and rel, or none.
 */
export const buildLinkCardLinkAttributes = (external: boolean): ILinkCardLinkAttributes =>
  external ? { rel: 'noreferrer', target: '_blank' } : {};

/**
 * Builds the classes of a link card's arrow: a right arrow in the top row that nudges on hover, or,
 * for a link to another site, an up-right arrow in the card's corner.
 * @param external Whether the card links to another site.
 * @returns The arrow's classes.
 */
export const buildLinkCardArrowClasses = (external: boolean): string =>
  external
    ? 'absolute top-5 right-5 size-4 text-muted transition-colors group-hover:text-foreground'
    : 'mt-0.5 size-4 shrink-0 text-muted transition-[color,translate] group-hover:translate-x-0.5 group-hover:text-foreground';
