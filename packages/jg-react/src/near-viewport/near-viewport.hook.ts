import { useEffect, useState } from 'react';

import type { IUseNearViewportOptions, IUseNearViewportResult } from './types.js';

/**
 * Watches whether an element is within a margin of the viewport, such as a sentinel at the end of
 * a list that loads more as it comes into view, with one IntersectionObserver for the element and
 * the margin. A browser without IntersectionObserver, and a server, read it as not near.
 * @param options The margin around the viewport.
 * @returns The ref to attach, and whether the element is near the viewport.
 * @example
 * import { useNearViewport } from 'jg-react';
 *
 * export const useLoadMoreSentinel = () => useNearViewport({ rootMargin: '0px 0px 512px 0px' });
 */
export const useNearViewport = ({
  rootMargin = '0px',
}: IUseNearViewportOptions = {}): IUseNearViewportResult => {
  const [element, setElement] = useState<Element | null>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    if (element === null || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // the entries come in order, so the last one says where the element is now
        for (const entry of entries) {
          setIsNear(entry.isIntersecting);
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [element, rootMargin]);

  return { ref: setElement, isNear: element !== null && isNear };
};
