/**
 * Scrolls a row sideways just enough to show the whole of one of its links, and never the page,
 * which `scrollIntoView` could scroll too. It does nothing without the row or the link, such as
 * when no item is the current one.
 * @param row The row, which scrolls sideways.
 * @param link The link to show.
 */
export const revealInRow = (row: HTMLElement | null, link: HTMLElement | null): void => {
  if (row === null || link === null) {
    return;
  }
  const rowBox = row.getBoundingClientRect();
  const linkBox = link.getBoundingClientRect();
  if (linkBox.left < rowBox.left) {
    row.scrollLeft -= rowBox.left - linkBox.left;
  } else if (linkBox.right > rowBox.right) {
    row.scrollLeft += linkBox.right - rowBox.right;
  }
};
