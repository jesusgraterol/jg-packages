// how long a navigation runs before the bar shows, so prerendered and fast pages never flash it
const SHOW_DELAY_MS = 150;

// after this long the navigation is taken to have stalled, such as a link that downloaded a file
// instead of leaving the page, and the bar hides
const STALL_TIMEOUT_MS = 15_000;

/**
 * Checks whether a click starts loading another page of this site in the same tab: a primary
 * button click without modifier keys, on a link no script handled, with no `target` but `_self`,
 * no `download`, the same origin, and more than a jump within the current page.
 * @param event The click.
 * @param location The current page's location.
 * @returns Whether the click navigates to a page of this site.
 */
export const isPageNavigationClick = (event: MouseEvent, location: Location): boolean => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return false;
  }
  const target = event.target as Partial<Element> | null;
  const link =
    typeof target?.closest === 'function' ? target.closest<HTMLAnchorElement>('a[href]') : null;
  if (link === null || !['', '_self'].includes(link.target) || link.hasAttribute('download')) {
    return false;
  }
  let destination: URL;
  try {
    destination = new URL(link.href, location.href);
  } catch {
    return false;
  }
  if (destination.origin !== location.origin) {
    return false;
  }
  const isSameDocument =
    destination.pathname === location.pathname && destination.search === location.search;
  return !(isSameDocument && destination.hash !== '');
};

/**
 * Shows the page's progress bar while a click's navigation runs longer than 150 ms, through one
 * click listener on the document. A normal navigation replaces the page, bar and all; a page
 * restored from the back/forward cache hides it again, and so does a 15-second stall. The attribute
 * it sets on the root element keeps a second call, even from another bundle, from adding a second
 * listener.
 * @param root The document. Defaults to the page's.
 */
export const registerNavigationProgress = (root: Document = document): void => {
  if (root.documentElement.hasAttribute('data-navigation-progress-ready')) {
    return;
  }
  root.documentElement.setAttribute('data-navigation-progress-ready', '');
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  const setHidden = (hidden: boolean): void => {
    const bar = root.querySelector<HTMLElement>('[data-navigation-progress]');
    if (bar) bar.hidden = hidden;
  };
  const hide = (): void => {
    clearTimeout(showTimer);
    clearTimeout(stallTimer);
    setHidden(true);
  };
  root.addEventListener('click', (event) => {
    if (!isPageNavigationClick(event, root.location)) {
      return;
    }
    hide();
    showTimer = setTimeout(() => {
      setHidden(false);
    }, SHOW_DELAY_MS);
    stallTimer = setTimeout(hide, STALL_TIMEOUT_MS);
  });
  root.defaultView?.addEventListener('pageshow', hide);
};
