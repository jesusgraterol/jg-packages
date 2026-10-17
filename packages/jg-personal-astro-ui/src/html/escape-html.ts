/**
 * Escapes text for HTML, in content and in quoted attribute values.
 * @param text The text.
 * @returns The escaped text.
 */
export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
