import { useLayoutEffect, useState } from 'react';
import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import type { IUseIsTextClampedOptions, IUseIsTextClampedResult } from './types.js';
import { isTallerThanLines } from './utilities.js';

/**
 * Measures whether a text runs past the lines its clamp shows, so a Show all control appears
 * only on text the clamp cuts off. It compares the text's full height with those lines, which
 * holds whether the text shows clamped or in full, so a row that opens already expanded still
 * offers Show less. A ResizeObserver measures it again whenever its box changes, such as on a
 * narrower screen, and new content is measured as it renders, before the browser paints.
 * @param options The lines the clamp shows, and the text.
 * @returns The ref to attach to the clamped element, and whether its text runs past the clamp.
 * @example
 * import { useIsTextClamped } from 'jg-react';
 *
 * export const useMessageClamp = (text: string) => useIsTextClamped({ lines: 3, content: text });
 * @throws
 * - INVALID_CLAMPED_LINES: The clamped lines must be a positive safe integer.
 */
export const useIsTextClamped = ({
  lines,
  content,
}: IUseIsTextClampedOptions): IUseIsTextClampedResult => {
  if (!Number.isSafeInteger(lines) || lines <= 0) {
    throw new Exception('The clamped lines must be a positive safe integer.', {
      code: ERRORS.INVALID_CLAMPED_LINES,
      data: { lines: String(lines) },
    });
  }
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [isClamped, setIsClamped] = useState(false);

  useLayoutEffect(() => {
    if (element === null) {
      setIsClamped(false);
      return undefined;
    }
    const measure = (): void => {
      setIsClamped(isTallerThanLines(element, lines));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [content, element, lines]);

  return { ref: setElement, isClamped };
};
