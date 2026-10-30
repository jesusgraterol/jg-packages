import type * as React from 'react';
import { cn } from 'cnfast';

import { iconTileVariants } from './constants.js';
import type { IIconTileProps } from './types.js';

/**
 * Renders the rounded-square tile that holds a leading icon, stacked media icon, or step number.
 * The tile is decorative by default; pass `aria-hidden={false}` when its content, such as a step number, must be announced.
 * @param props The span props, the named size, and the status tone.
 * @returns A React element that renders the icon tile.
 * @example
 * import { createElement } from 'react';
 * import { IconTile } from 'jg-react-ui/components/icon-tile';
 * const example = createElement(IconTile, null, 'Example');
 */
export const IconTile = ({
  className,
  size = 'md',
  tone = 'neutral',
  'aria-hidden': ariaHidden = true,
  ...props
}: IIconTileProps): React.ReactElement => (
  <span
    data-slot="icon-tile"
    data-size={size}
    data-tone={tone}
    aria-hidden={ariaHidden}
    className={cn(iconTileVariants({ size, tone }), className)}
    {...props}
  />
);
