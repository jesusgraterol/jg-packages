import { expect, type Page } from '@playwright/test';

// the most overflowing elements a failure names
const MAX_NAMED_ELEMENTS = 8;

/**
 * Measures, in the page, whether its document is wider than the viewport's content box.
 * @param maxNamedElements The most elements to name.
 * @returns Null when nothing overflows, or a description of the overflow and the elements whose
 * right edge passes the viewport.
 */
const describeHorizontalOverflow = (maxNamedElements: number): string | null => {
  const { clientWidth, scrollWidth } = document.documentElement;
  if (scrollWidth <= clientWidth) {
    return null;
  }
  const names: string[] = [];
  for (const element of document.body.querySelectorAll('*')) {
    if (element.getBoundingClientRect().right + window.scrollX > clientWidth) {
      const classes = [...element.classList].map((name) => `.${name}`).join('');
      names.push(`${element.tagName.toLowerCase()}${classes}`);
      if (names.length === maxNamedElements) {
        break;
      }
    }
  }
  return `The page is ${scrollWidth} px wide in a ${clientWidth} px viewport. Past its right edge: ${names.join(', ')}`;
};

/**
 * Asserts that the page doesn't scroll sideways, retrying until it settles. It compares the
 * document's width with the viewport's `clientWidth`, which leaves out a classic scrollbar, so an
 * overflow a scrollbar hides still fails. A failure names up to 8 elements past the right edge,
 * by tag and classes.
 * @param page The page.
 * @returns A promise that resolves once the page fits the viewport, or rejects with Playwright's
 * assertion error after its expect timeout.
 * @example
 * import { test } from '@playwright/test';
 * import { expectNoHorizontalOverflow } from 'jg-playwright';
 *
 * test('the pricing page fits a small phone', async ({ page }) => {
 *   await page.setViewportSize({ width: 320, height: 640 });
 *   await page.goto('/pricing');
 *   await expectNoHorizontalOverflow(page);
 * });
 */
export const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  await expect
    .poll(() => page.evaluate(describeHorizontalOverflow, MAX_NAMED_ELEMENTS), {
      message: 'The page must not scroll horizontally',
    })
    .toBeNull();
};
