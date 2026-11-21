import { renderGuideHtml, renderGuideReadme } from './presentation.js';
import type { IPublishingGuide, IPublishingGuideOptions, IPublishingGuideResult } from './types.js';
import { validateGuide } from './validations.js';

/**
 * Renders a caller-approved selection into a self-contained HTML guide and a plain-text README.
 * The HTML uses local relative file links and an inline script permitted by its exact CSP hash.
 * @param guide The title, selected files and optional channel steps.
 * @param copy Reviewed literal text keyed by selected local filename.
 * @param options The guide interface locale.
 * @returns The HTML and plain-text documents.
 * @example
 * import { renderPublishingGuide } from 'jg-publishing-guides';
 *
 * const { html, readme } = renderPublishingGuide(
 *   {
 *     title: 'Reviewed caption',
 *     summary: 'Selected copy for manual publication.',
 *     files: [{ path: 'caption.txt', label: 'Caption', details: 'Reviewed text.', kind: 'file' }],
 *   },
 *   new Map([['caption.txt', 'Copy for the published post.']]),
 * );
 * // write html to start-here.html and readme to readme.txt beside caption.txt
 * void [html, readme];
 * @throws
 * - INVALID_PUBLISHING_GUIDE: The publishing guide input is invalid.
 */
export const renderPublishingGuide = (
  guide: IPublishingGuide,
  copy: ReadonlyMap<string, string> = new Map(),
  { locale = 'en' }: IPublishingGuideOptions = {},
): IPublishingGuideResult => {
  validateGuide(guide, copy, locale);
  return {
    html: renderGuideHtml(guide, copy, locale),
    readme: renderGuideReadme(guide, copy, locale),
  };
};
