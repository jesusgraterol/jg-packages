/**
 * Gets the value of a property from the last item when the array length reaches the initial page size.
 * @param propName The property name to read from the last item.
 * @param items The array of items from which to read the last property value.
 * @param initialPageSize The expected page size required before reading the last property value.
 * @returns The last item's property value, or undefined when the array length is below the initial page size.
 * @example
 * import { getNextPageParam } from 'jg-utilities';
 *
 * // with a page size of 2, a full page means there may be more
 * getNextPageParam('id', [{ id: 1 }, { id: 2 }], 2); // => 2
 * getNextPageParam('id', [{ id: 3 }], 2); // => undefined
 */
export const getNextPageParam = <T extends object, K extends keyof T>(
  propName: K,
  items: T[],
  initialPageSize: number,
): T[K] | undefined => {
  if (items.length < initialPageSize) {
    return undefined;
  }
  return items.at(-1)?.[propName];
};
