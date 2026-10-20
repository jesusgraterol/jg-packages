import { useEffect, useState } from 'react';

import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import { OBSERVER_BOTTOM_MARGIN } from './constants.js';
import type { IUseActiveHeadingOptions, IUseActiveHeadingResult } from './types.js';
import { pickActiveHeadingId, readHeadingIdFromHash } from './utilities.js';

// the separator of the heading ids' key, a character no id holds
const HEADING_KEY_SEPARATOR = '\u0000';

/**
 * Follows which heading the reader is at, for a table of contents that highlights it: the heading
 * the URL's hash names, on mount and on every `hashchange`, and then, as the page scrolls, the
 * last heading whose top has passed `topOffsetPx`, the height of a sticky header, or the first
 * heading before any has. Scrolling is followed with an IntersectionObserver, and only the hash
 * without one. The ids are compared by value, so a new array with the same ids doesn't restart
 * anything, and a heading missing from the page is skipped.
 * @param options The headings' ids, in page order, and the top offset in pixels.
 * @returns The active heading's id, and the function that sets it, such as on a link's click.
 * @example
 * import { useActiveHeading } from 'jg-react';
 *
 * export const useTableOfContents = (headingIds: readonly string[]) =>
 *   useActiveHeading({ headingIds, topOffsetPx: 80 });
 * @throws
 * - INVALID_ACTIVE_HEADING_OFFSET: The active heading's top offset must be a finite number of pixels of at least 0.
 */
export const useActiveHeading = ({
  headingIds,
  topOffsetPx,
}: IUseActiveHeadingOptions): IUseActiveHeadingResult => {
  if (!Number.isFinite(topOffsetPx) || topOffsetPx < 0) {
    throw new Exception(
      "The active heading's top offset must be a finite number of pixels of at least 0.",
      { code: ERRORS.INVALID_ACTIVE_HEADING_OFFSET },
    );
  }
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const headingKey = headingIds.join(HEADING_KEY_SEPARATOR);

  useEffect(() => {
    const ids = headingKey === '' ? [] : headingKey.split(HEADING_KEY_SEPARATOR);
    const followHash = (): void => {
      const id = readHeadingIdFromHash(window.location.hash);
      if (id !== null && ids.includes(id)) {
        setActiveHeadingId(id);
      }
    };
    followHash();
    window.addEventListener('hashchange', followHash);
    if (typeof IntersectionObserver === 'undefined') {
      return () => {
        window.removeEventListener('hashchange', followHash);
      };
    }
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element) => element !== null);
    const observer = new IntersectionObserver(
      () => {
        setActiveHeadingId(pickActiveHeadingId(elements, topOffsetPx));
      },
      {
        rootMargin: `-${String(topOffsetPx)}px 0px ${OBSERVER_BOTTOM_MARGIN} 0px`,
        threshold: [0, 1],
      },
    );
    for (const element of elements) {
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', followHash);
    };
  }, [headingKey, topOffsetPx]);

  return { activeHeadingId, setActiveHeadingId };
};
