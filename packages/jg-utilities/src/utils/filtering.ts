import type { IFilterByQueryOptions } from './types.js';
import { buildNormalizedQueryTokens } from './transformers.js';
import { filterItemsByQueryTokens } from './utilities.js';

/**
 * Filters an array of primitives based on a given query and returns a shallow copy.
 * @IMPORTANT Providing the queryProp makes the query very efficient as it only attempts to match
 * the value of that property, instead of the whole item.
 * @param items The array of items to be filtered by the query.
 * @param query The query string to filter the items by.
 * @param options? The options to filter the items by query.
 * @returns A new array containing the items that match the query based on the provided options.
 * @example
 * import { filterByQuery } from 'jg-utilities';
 *
 * filterByQuery([{ name: 'Ada' }, { name: 'Alan' }, { name: 'Grace' }], 'al', { queryProp: 'name' }); // => [{ name: 'Alan' }]
 */
export const filterByQuery = <T>(
  items: T[],
  query: string,
  options?: IFilterByQueryOptions<T>,
): T[] => {
  if (!items.length || !query) {
    return items.slice();
  }

  // build the query tokens
  const queryTokens = buildNormalizedQueryTokens(query);
  if (!queryTokens.length) {
    return items.slice();
  }

  // apply the filter to the items based on the query and provided options
  const filteredItems = filterItemsByQueryTokens(items, queryTokens, options?.queryProp);
  if (typeof options?.limit === 'number') {
    return filteredItems.slice(0, options.limit);
  }
  return filteredItems;
};
