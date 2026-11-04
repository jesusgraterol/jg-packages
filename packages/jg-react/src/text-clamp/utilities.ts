// the line height `normal` gives most fonts, used when the computed line height isn't a length
const NORMAL_LINE_HEIGHT = 1.2;

/**
 * Tells whether an element's text is taller than a number of its lines, comparing its full
 * height with them, which holds whether it shows clamped or in full.
 * @param element The element.
 * @param lines The lines.
 * @returns Whether the text runs past them.
 */
export const isTallerThanLines = (element: HTMLElement, lines: number): boolean => {
  const style = getComputedStyle(element);
  const lineHeight =
    Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * NORMAL_LINE_HEIGHT;
  return element.scrollHeight > lineHeight * lines + 1;
};
