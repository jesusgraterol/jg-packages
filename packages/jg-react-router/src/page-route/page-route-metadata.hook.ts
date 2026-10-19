import { useMatches } from 'react-router';

import type { IPageRouteHandle, IPageRouteMetadata } from './types.js';

/**
 * Checks whether a route's handle holds a page's title and description, as createPageRouteObject
 * sets them.
 * @param handle The handle.
 * @returns Whether it's a page route's handle.
 */
const isPageRouteHandle = (handle: unknown): handle is IPageRouteHandle => {
  if (typeof handle !== 'object' || handle === null) {
    return false;
  }
  const { pageMetadata } = handle as { pageMetadata?: unknown };
  if (typeof pageMetadata !== 'object' || pageMetadata === null) {
    return false;
  }
  const { title, description } = pageMetadata as { title?: unknown; description?: unknown };
  return typeof title === 'string' && typeof description === 'string';
};

/**
 * Gives the title and description of the deepest matched page route, such as for the document's
 * title or a page header in a layout. A handle without a string title and description is skipped.
 * @returns The page's metadata, or null when no matched route is a page route.
 * @example
 * import { useEffect } from 'react';
 * import { usePageRouteMetadata } from 'jg-react-router';
 *
 * export const useDocumentTitle = () => {
 *   const pageMetadata = usePageRouteMetadata();
 *   useEffect(() => {
 *     document.title = pageMetadata === null ? 'App' : `${pageMetadata.title} | App`;
 *   }, [pageMetadata]);
 * };
 */
export const usePageRouteMetadata = (): IPageRouteMetadata | null => {
  const matches = useMatches();
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const handle = matches[index]?.handle;
    if (isPageRouteHandle(handle)) {
      return handle.pageMetadata;
    }
  }
  return null;
};
