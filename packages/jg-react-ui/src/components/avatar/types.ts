import type { AVATAR_SIZE_CLASS_NAMES } from './constants.js';

/** Avatar sides: xs 16px, sm 20px, md 28px, lg 36px and xl 44px.
 * @see Avatar
 */
export type IAvatarSize = keyof typeof AVATAR_SIZE_CLASS_NAMES;

/** How an avatar shows its image: filling it, or as a logo inset on its tile.
 * @see Avatar
 */
export type IAvatarFit = 'cover' | 'inset';

/** Options for Avatar: its image, its name, and how it looks.
 * @see Avatar
 */
export type IAvatarProps = {
  // the image, or null for none
  src?: string | null | undefined;
  // what the avatar shows; '' when the name already shows beside it, which makes it decorative
  alt: string;
  // the text whose first character the fallback shows, such as the name, or '?' for an unknown one
  fallback: string;
  // defaults to md
  size?: IAvatarSize;
  // defaults to cover
  fit?: IAvatarFit;
  // the tile's classes, such as its tint or a circle's rounding
  className?: string;
  // the image's classes, such as inverting a dark logo in the dark theme
  imageClassName?: string;
};
