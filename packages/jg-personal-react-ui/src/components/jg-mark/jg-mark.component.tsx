import { JG_MARK_PATHS, JG_MARK_TILE, JG_MARK_VIEW_BOX } from 'jg-personal-ui/brand';

import type { IJgMarkProps } from './types.js';

/**
 * Renders the fixed JG artwork as a decorative mark, matching the existing Astro component.
 * @param props Layout classes for the square mark.
 * @returns The outlined, non-focusable brand mark.
 * @example
 * import { createElement } from 'react';
 * import { JgMark } from 'jg-personal-react-ui/components/jg-mark';
 * const mark = createElement(JgMark, { className: 'size-10' });
 */
export const JgMark = ({ className }: IJgMarkProps) => (
  <svg
    className={className}
    width="64"
    height="64"
    viewBox={JG_MARK_VIEW_BOX}
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect {...JG_MARK_TILE} />
    {JG_MARK_PATHS.map((path) => (
      <path
        key={path.d}
        {...path}
      />
    ))}
  </svg>
);
