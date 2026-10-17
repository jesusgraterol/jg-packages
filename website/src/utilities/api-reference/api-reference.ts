/**
 * Escapes text for HTML.
 * @param text The text.
 * @returns The escaped text.
 */
const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * Renders TSDoc text as HTML paragraphs: backticks become code, line breaks within a paragraph
 * become spaces, and blank lines separate paragraphs.
 * @param text The TSDoc text.
 * @returns The HTML.
 */
export const renderDocText = (text: string): string =>
  text
    .trim()
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim() !== '')
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph.replaceAll(/\s*\n\s*/g, ' ')).replaceAll(
          /`([^`]+)`/g,
          '<code>$1</code>',
        )}</p>`,
    )
    .join('');
