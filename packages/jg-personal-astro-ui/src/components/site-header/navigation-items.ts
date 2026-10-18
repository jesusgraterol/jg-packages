// one link of the site header's navigation
export type INavigationItem = {
  // opens another site in a new tab, with the arrow, the new-tab notice, and no referrer
  external?: boolean | undefined;
  href: string;
  label: string;
  // 'prefix' also marks the item current on the pages under it, such as /cookbook/x/ for
  // /cookbook/. Defaults to 'exact'
  match?: 'exact' | 'prefix' | undefined;
};

/**
 * Checks whether a navigation item is the current page's. An external item never is, and a prefix
 * match on the home page's `/` would mark every page, so it matches exactly.
 * @param item The item.
 * @param currentPath The current page's path, if the site passes one.
 * @returns Whether to mark the item with aria-current="page".
 */
export const isCurrentItem = (
  { external = false, href, match = 'exact' }: INavigationItem,
  currentPath: string | undefined,
): boolean => {
  if (external || currentPath === undefined) {
    return false;
  }
  if (match === 'exact' || href === '/') {
    return currentPath === href;
  }
  return currentPath === href || currentPath.startsWith(href.endsWith('/') ? href : `${href}/`);
};

/**
 * Finds the section a navigation item links to on the current page, which section tracking
 * follows: `#about`, or `/#about` while on `/`.
 * @param item The item.
 * @param currentPath The current page's path, if the site passes one.
 * @returns The section's id, or undefined when the item leads elsewhere.
 */
export const findItemSectionId = (
  { external = false, href }: INavigationItem,
  currentPath: string | undefined,
): string | undefined => {
  if (external) {
    return undefined;
  }
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1 || hashIndex === href.length - 1) {
    return undefined;
  }
  const path = href.slice(0, hashIndex);
  return path === '' || path === currentPath ? href.slice(hashIndex + 1) : undefined;
};
