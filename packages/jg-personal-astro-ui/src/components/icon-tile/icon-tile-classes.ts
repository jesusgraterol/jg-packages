// how large an icon tile is: 'card' leads a card's top row, 'header' opens a page
export type IIconTileSize = 'card' | 'header';

// the tile's shared look: a primary square, which inverts in dark mode like a primary button
const TILE_CLASSES =
  'inline-flex shrink-0 items-center justify-center bg-primary text-primary-foreground';

// the tile's size and corner radius, and the size of the icon in its slot
const SIZE_CLASSES: Record<IIconTileSize, string> = {
  card: 'size-10 rounded-lg [&>svg]:size-5',
  header: 'size-14 rounded-xl [&>svg]:size-7',
};

/**
 * Builds the classes of an icon tile. The tile sizes the icon in its slot, so a site passes a bare
 * icon, such as a Lucide component.
 * @param size The tile's size. Defaults to 'card'.
 * @returns The tile's classes.
 */
export const buildIconTileClasses = (size: IIconTileSize = 'card'): string =>
  `${TILE_CLASSES} ${SIZE_CLASSES[size]}`;
