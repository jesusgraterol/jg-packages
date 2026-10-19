import { DEFAULT_PAGE_RETURN_STATE_KEY, INTERNAL_BASE_URL } from './constants.js';
import type { IPageReturn, IPageReturnOptions, IPageReturnOrigin } from './types.js';
import { isPlainRecord, readInternalUrl } from './utilities.js';

/**
 * Creates the way back to the page a navigation came from, such as a list a detail page was
 * opened from, kept in the router state rather than the URL. `createState(href, state)` records
 * the page in the state of the navigation away from it, replacing an earlier origin and keeping
 * the rest of the state. `resolve(state, currentHref)` gives the page to return to and its label,
 * with the state to return with, which no longer holds the origin, so the way back is used once.
 *
 * An origin must be a safe internal path, not under `excludedPaths`, which `resolveOrigin`
 * accepts: it gives the label, and keeps only the query it allows, such as through
 * retainSearchParams. The hash is dropped. No way back is offered to the current page, its
 * pathname, or `parentHref`, the page the current one's own back link leads to, and a state that
 * isn't valid offers none.
 * @param options The state key, the excluded paths, and the app's origins.
 * @returns The functions.
 * @example
 * import { createPageReturn, retainSearchParams } from 'jg-react-router';
 *
 * const LABELS: Record<string, string> = { '/payments': 'Payments', '/projects': 'All projects' };
 *
 * export const pageReturn = createPageReturn({
 *   excludedPaths: ['/sign-in'],
 *   resolveOrigin: (url) => {
 *     const label = Object.hasOwn(LABELS, url.pathname) ? LABELS[url.pathname] : undefined;
 *     const search = retainSearchParams(url.searchParams, { status: { defaultValue: 'all' } });
 *     return label === undefined || search === null
 *       ? null
 *       : { href: `${url.pathname}${search.size > 0 ? `?${search.toString()}` : ''}`, label };
 *   },
 * });
 *
 * pageReturn.createState('/payments?status=failed'); // => { pageReturn: { href: '/payments?status=failed' } }
 */
export const createPageReturn = ({
  stateKey = DEFAULT_PAGE_RETURN_STATE_KEY,
  excludedPaths = [],
  resolveOrigin,
}: IPageReturnOptions): IPageReturn => {
  const normalizeOrigin = (candidate: unknown): IPageReturnOrigin | null => {
    const url = readInternalUrl(candidate, excludedPaths);
    const origin = url === null ? null : resolveOrigin(url);
    // the app's href must be internal too, and the label shown as a link's text
    const href = origin === null ? null : readInternalUrl(origin.href, excludedPaths);
    if (
      origin === null ||
      href === null ||
      typeof origin.label !== 'string' ||
      origin.label === ''
    ) {
      return null;
    }
    return { href: `${href.pathname}${href.search}`, label: origin.label };
  };

  return {
    normalizeOrigin,
    createState: (href, state) => {
      const origin = normalizeOrigin(href);
      return {
        ...(isPlainRecord(state) ? state : {}),
        [stateKey]: origin === null ? undefined : { href: origin.href },
      };
    },
    resolve: (state, currentHref, { parentHref } = {}) => {
      const record = isPlainRecord(state) ? state : undefined;
      const descriptor = record?.[stateKey];
      // the only shape createState writes; anything else, from an older version or another app,
      // offers no way back
      const isDescriptorValid =
        isPlainRecord(descriptor) &&
        typeof descriptor['href'] === 'string' &&
        Object.keys(descriptor).length === 1;
      const origin = isDescriptorValid ? normalizeOrigin(descriptor['href']) : null;
      const current = new URL(currentHref, INTERNAL_BASE_URL);
      const currentPathname = current.pathname.replace(/\/$/, '') || '/';
      const suppressed = [
        normalizeOrigin(currentHref)?.href,
        parentHref === undefined ? undefined : (normalizeOrigin(parentHref)?.href ?? parentHref),
      ];
      // the state without the origin, so the return doesn't offer a way back again
      const returnState =
        record === undefined
          ? undefined
          : Object.fromEntries(Object.entries(record).filter(([key]) => key !== stateKey));
      return {
        returnState,
        returnTo:
          origin !== null &&
          !suppressed.includes(origin.href) &&
          origin.href.split('?')[0] !== currentPathname
            ? origin
            : null,
      };
    },
  };
};
