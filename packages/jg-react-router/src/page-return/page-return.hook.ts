import { useMemo } from 'react';
import { useLocation } from 'react-router';

import type { IPageReturn, IPageReturnResolution, IResolvePageReturnOptions } from './types.js';

/**
 * Resolves the way back to the page the current one was reached from, from the current location's
 * router state, as `pageReturn.resolve` does: the page to return to and its label, or null, and
 * the state to navigate back with, which no longer holds the origin.
 * @param pageReturn The app's page return, from createPageReturn.
 * @param options The page the current one's own back link leads to.
 * @returns The way back, and the state to return with.
 * @example
 * import { createPageReturn, usePageReturn } from 'jg-react-router';
 *
 * declare const pageReturn: ReturnType<typeof createPageReturn>;
 *
 * export const useBackLink = () => {
 *   const { returnTo, returnState } = usePageReturn(pageReturn, { parentHref: '/payments' });
 *   return returnTo === null
 *     ? { href: '/payments', label: 'Payments', state: undefined }
 *     : { ...returnTo, state: returnState };
 * };
 */
export const usePageReturn = (
  pageReturn: IPageReturn,
  { parentHref }: IResolvePageReturnOptions = {},
): IPageReturnResolution => {
  const { state, pathname, search } = useLocation() as {
    state: unknown;
    pathname: string;
    search: string;
  };
  return useMemo(
    () => pageReturn.resolve(state, `${pathname}${search}`, { parentHref }),
    [pageReturn, state, pathname, search, parentHref],
  );
};
