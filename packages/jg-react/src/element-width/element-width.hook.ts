import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { IUseElementWidthResult } from './types.js';
import { readBorderBoxWidth } from './utilities.js';

/**
 * Reads an element's width as a value the component needs, such as how many columns fit, and
 * re-renders only when that value changes, not on every pixel. It measures the element's border
 * box as soon as it's attached, before the browser paints, then follows it with a
 * ResizeObserver, or the window's resize event where there's none. A width of 0, such as while
 * the element is hidden with `display: none`, keeps the last value. Attaching another element
 * measures that one, and detaching resets the value to undefined, as on a server.
 * @param select Turns a width in pixels into the value, such as a column count.
 * @returns The ref to attach, and the value.
 * @example
 * import { useElementWidth } from 'jg-react';
 *
 * export const useGridColumns = () => useElementWidth((width) => Math.max(1, Math.floor(width / 280)));
 */
export const useElementWidth = <T>(select: (width: number) => T): IUseElementWidthResult<T> => {
  const [element, setElement] = useState<Element | null>(null);
  const [value, setValue] = useState<T | undefined>(undefined);
  // the latest select, so a new function each render doesn't re-subscribe
  const selectRef = useRef(select);
  // the value last set, compared here because React may render once before it skips a same value
  const valueRef = useRef<T | undefined>(undefined);

  useLayoutEffect(() => {
    selectRef.current = select;
  });

  useLayoutEffect(() => {
    const setNextValue = (next: T | undefined): void => {
      if (!Object.is(next, valueRef.current)) {
        valueRef.current = next;
        setValue(next);
      }
    };
    if (element === null) {
      setNextValue(undefined);
      return undefined;
    }
    const update = (width: number): void => {
      // a hidden element measures 0, which says nothing about the space it has
      if (width > 0) {
        setNextValue(selectRef.current(width));
      }
    };
    update(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') {
      const onResize = (): void => {
        update(element.getBoundingClientRect().width);
      };
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
      };
    }
    const observer = new ResizeObserver(([entry]) => {
      update(readBorderBoxWidth(entry, element));
    });
    observer.observe(element, { box: 'border-box' });
    return () => {
      observer.disconnect();
    };
  }, [element]);

  const ref = useCallback((next: Element | null) => {
    setElement(next);
  }, []);

  return { ref, value };
};
