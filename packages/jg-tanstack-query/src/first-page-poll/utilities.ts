import type { InfiniteData } from '@tanstack/react-query';

import type { IPageRow, IRowPage } from './types.js';

/**
 * Merges a newly read first page into a paged list's loaded pages, matching rows by ID: rows the
 * list doesn't hold yet go ahead of its first page, and rows it holds take the new version where
 * they are, on any page. The pages after the first keep their place, their cursors and their
 * page params, so a list that loaded more never loses them. Merging the same page twice changes
 * nothing more.
 * @param data The loaded pages.
 * @param firstPage The newly read first page.
 * @param getRowId Gives a row's ID.
 * @returns The merged pages, or the loaded ones when there are none.
 * @example
 * import type { InfiniteData } from '@tanstack/react-query';
 * import { mergeFirstPage } from 'jg-tanstack-query';
 *
 * type IEventPage = { data: { id: string; title: string }[]; nextCursor: string | null };
 *
 * export const addLatestEvents = (
 *   loaded: InfiniteData<IEventPage, string | null>,
 *   latest: IEventPage,
 * ) => mergeFirstPage(loaded, latest, (event) => event.id);
 */
export const mergeFirstPage = <TPage extends IRowPage, TPageParam>(
  data: InfiniteData<TPage, TPageParam>,
  firstPage: TPage,
  getRowId: (row: IPageRow<TPage>) => string,
): InfiniteData<TPage, TPageParam> => {
  const [loadedFirst, ...rest] = data.pages;
  if (loadedFirst === undefined) {
    return data;
  }
  const read = new Map(firstPage.data.map((row) => [getRowId(row), row]));
  const held = new Set<string>();
  const update = (page: TPage): TPage => ({
    ...page,
    data: page.data.map((row) => {
      const id = getRowId(row);
      held.add(id);
      return read.get(id) ?? row;
    }),
  });
  const updatedFirst = update(loadedFirst);
  const updatedRest = rest.map(update);
  const added = firstPage.data.filter((row) => !held.has(getRowId(row)));
  return {
    ...data,
    pages: [{ ...updatedFirst, data: [...added, ...updatedFirst.data] }, ...updatedRest],
  };
};
