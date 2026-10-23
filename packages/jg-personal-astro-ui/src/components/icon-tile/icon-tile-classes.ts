// compact tiles fit dense rows, card tiles lead a card, and header tiles open a page
export type IIconTileSize = 'card' | 'compact' | 'header';

// semantic colors keep their meaning on ordinary and inverse surfaces
export type IIconTileTone = 'accent' | 'danger' | 'neutral' | 'primary' | 'success' | 'warning';

// shared alignment; the selected tone owns the palette
const TILE_CLASSES = 'inline-flex shrink-0 items-center justify-center';

const TONE_CLASSES: Record<IIconTileTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  neutral: 'bg-secondary text-foreground',
  accent: 'bg-accent text-accent-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

// the tile's size and corner radius, and the size of the icon in its slot
const SIZE_CLASSES: Record<IIconTileSize, string> = {
  card: 'size-10 rounded-lg [&>svg]:size-5',
  header: 'size-14 rounded-xl [&>svg]:size-7',
  compact: 'size-8 rounded-md [&>svg]:size-4',
};

/**
 * Builds the classes of an icon tile. The tile sizes the icon in its slot, so a site passes a bare
 * icon, such as a Lucide component.
 * @param size The tile's size. Defaults to 'card'.
 * @param tone The tile's semantic palette. Defaults to 'primary'.
 * @returns The tile's classes.
 */
export const buildIconTileClasses = (
  size: IIconTileSize = 'card',
  tone: IIconTileTone = 'primary',
): string => `${TILE_CLASSES} ${TONE_CLASSES[tone]} ${SIZE_CLASSES[size]}`;
