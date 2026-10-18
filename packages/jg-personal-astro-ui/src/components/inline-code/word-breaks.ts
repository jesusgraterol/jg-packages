import { escapeHtml } from '../../html/index.ts';

// the characters a long name may break after, such as in a path or a snake_case name
const BREAK_AFTER = /([/_.-])/gu;

/**
 * Escapes text for HTML and lets it wrap after `/`, `_`, `.`, and `-`, so a long path or name
 * breaks at its separators instead of overflowing a narrow screen.
 * @param text The text, such as `node_modules/jg-fetch/API.md`.
 * @returns The escaped HTML, with a `<wbr>` after each separator.
 * @example
 * insertWordBreaks('jg-fetch/API.md'); // 'jg-<wbr>fetch/<wbr>API.<wbr>md'
 */
export const insertWordBreaks = (text: string): string =>
  escapeHtml(text).replaceAll(BREAK_AFTER, '$1<wbr>');
