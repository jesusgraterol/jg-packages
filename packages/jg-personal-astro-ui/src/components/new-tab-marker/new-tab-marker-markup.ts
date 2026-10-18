import { escapeHtml } from '../../html/index.ts';

// what renderNewTabMarker needs
export type INewTabMarkerOptions = {
  // shows the arrow; the notice for screen readers always renders. Defaults to true
  icon?: boolean | undefined;
};

// spoken after an external link's text, so screen reader users know it opens a new tab
export const NEW_TAB_NOTICE = ' (opens in a new tab)';

// Lucide's arrow-up-right (ISC License), with its viewBox cropped to the arrow, so no blank space
// sits between the arrow and the next character. data-new-tab-marker is the stable hook tests and
// markup allowlists find it by
const ARROW_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 6 12 12" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="ml-[0.15em] inline-block size-[0.6em] shrink-0" data-new-tab-marker><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>';

/**
 * Renders what follows an external link's text as HTML: an up-right arrow, unless the icon is
 * turned off, and a notice for screen readers that the link opens in a new tab. Links built by the
 * package's components and by externalLinkPlugin all end with it.
 * @param options Whether to show the arrow.
 * @returns The HTML.
 * @example
 * import { renderNewTabMarker } from 'jg-personal-astro-ui/new-tab-marker-markup';
 *
 * const link = `<a href="https://example.com/" target="_blank" rel="noreferrer">Example${renderNewTabMarker()}</a>`;
 */
export const renderNewTabMarker = ({ icon = true }: INewTabMarkerOptions = {}): string =>
  `${icon ? ARROW_ICON : ''}<span class="sr-only">${escapeHtml(NEW_TAB_NOTICE)}</span>`;
