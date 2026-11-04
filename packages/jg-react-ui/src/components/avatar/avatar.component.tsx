import { useState } from 'react';
import type * as React from 'react';
import { cn } from 'cnfast';

import { AVATAR_SIZE_CLASS_NAMES, AVATAR_SIZE_PIXELS } from './constants.js';
import type { IAvatarProps } from './types.js';

/**
 * Renders an image, such as a person's photo, a favicon or a logo, on a tile of a fixed size, and
 * the first character of its fallback in the same tile when there's no image or it fails to
 * load, so the layout never shifts. An avatar with an empty `alt` is decorative, for a name that
 * shows beside it; otherwise the image, or the fallback tile, carries the name.
 * @param props The image, its name and fallback, its size and fit, and its classes.
 * @returns A React element that renders the avatar.
 * @example
 * import { createElement } from 'react';
 * import { Avatar } from 'jg-react-ui/components/avatar';
 * const example = createElement(Avatar, { src: '/people/ada.png', alt: '', fallback: 'Ada' });
 */
export const Avatar = ({
  src,
  alt,
  fallback,
  size = 'md',
  fit = 'cover',
  className,
  imageClassName,
}: IAvatarProps): React.ReactElement => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isDecorative = alt === '';
  const tileClassName = cn(
    'bg-secondary text-secondary-foreground inline-flex shrink-0 items-center justify-center overflow-hidden leading-none font-semibold uppercase',
    AVATAR_SIZE_CLASS_NAMES[size],
    className,
  );

  if (src !== undefined && src !== null && src !== failedSrc) {
    const pixels = AVATAR_SIZE_PIXELS[size];
    return (
      <span
        data-slot="avatar"
        className={tileClassName}
      >
        <img
          alt={alt}
          data-fit={fit}
          decoding="async"
          height={pixels}
          loading="lazy"
          src={src}
          width={pixels}
          className={cn(
            fit === 'cover' ? 'size-full object-cover' : 'object-contain',
            imageClassName,
          )}
          onError={() => {
            setFailedSrc(src);
          }}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden={isDecorative ? true : undefined}
      aria-label={isDecorative ? undefined : alt}
      data-initial={fallback.charAt(0)}
      data-slot="avatar"
      role={isDecorative ? undefined : 'img'}
      className={cn(tileClassName, 'before:content-[attr(data-initial)]')}
    />
  );
};
