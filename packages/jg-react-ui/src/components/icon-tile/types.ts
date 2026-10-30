import type * as React from 'react';

/** Named tile sizes follow the text beside the tile; components choose one and never invent another.
 * @see IconTile
 */
export type IIconTileSize = 'sm' | 'md' | 'lg';

/** Tile tones carry status semantics; neutral tints from the surrounding text color.
 * @see IconTile
 */
export type IIconTileTone = 'neutral' | 'brand' | 'success' | 'warning' | 'destructive';

/** Icon tile props extend the span contract; classname is reserved for layout such as margins or grid placement.
 * @see IconTile
 */
export type IIconTileProps = React.ComponentProps<'span'> & {
  size?: IIconTileSize;
  tone?: IIconTileTone;
};
