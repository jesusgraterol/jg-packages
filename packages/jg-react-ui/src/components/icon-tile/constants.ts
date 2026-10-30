import { cva } from 'class-variance-authority';

import type { IIconTileSize, IIconTileTone } from './types.js';

// each size keeps the icon at half the tile and rounds the corners in proportion.
const ICON_TILE_SIZE_CLASS_NAMES = {
  sm: 'size-8 rounded-md text-xs [&_img]:size-4 [&_svg]:size-4',
  md: 'size-10 rounded-lg text-sm [&_img]:size-5 [&_svg]:size-5',
  lg: 'size-12 rounded-xl text-base [&_img]:size-6 [&_svg]:size-6',
} satisfies Record<IIconTileSize, string>;

/*
 * Neutral tints from currentColor so one tile reads on light, muted and inverse surfaces.
 * Warning mixes the light amber toward the foreground so the icon keeps contrast, matching Badge.
 */
const ICON_TILE_TONE_CLASS_NAMES = {
  neutral: 'bg-current/6 dark:bg-current/12',
  brand: 'bg-primary text-primary-foreground',
  success: 'bg-chart-1/10 text-chart-1 dark:bg-chart-1/15',
  warning:
    'bg-chart-2/10 text-[color:color-mix(in_oklab,var(--chart-2)_45%,var(--foreground))] dark:bg-chart-2/15 dark:text-chart-2',
  destructive: 'bg-destructive/10 text-destructive dark:bg-destructive/20',
} satisfies Record<IIconTileTone, string>;

// shared icon tile styles for leading icons, stacked media and step numbers.
/**
 * Composes the retained icon-tile variant classes.
 * @example
 * import { iconTileVariants } from 'jg-react-ui/components/icon-tile';
 * const styles = iconTileVariants({});
 */
export const iconTileVariants = cva(
  'flex shrink-0 items-center justify-center font-semibold tabular-nums [&_img]:shrink-0 [&_svg]:shrink-0',
  {
    variants: {
      size: ICON_TILE_SIZE_CLASS_NAMES,
      tone: ICON_TILE_TONE_CLASS_NAMES,
    },
    defaultVariants: {
      size: 'md',
      tone: 'neutral',
    },
  },
);
