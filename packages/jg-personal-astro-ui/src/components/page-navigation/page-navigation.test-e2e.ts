import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`directions and long titles remain readable with empty and single links in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/documentation/');
    const both = page.getByRole('navigation', { name: 'Page navigation', exact: true });
    const previous = both.getByRole('link', { name: /^Previous Shared foundations/u });
    const next = both.getByRole('link', { name: /^Next Technical examples/u });
    await expect(previous).toHaveAttribute('href', '/foundations/');
    await expect(previous).toHaveAttribute('rel', 'prev');
    await expect(next).toHaveAttribute('href', '/technical-content/');
    await expect(next).toHaveAttribute('rel', 'next');
    await expect(
      page.getByRole('navigation', { name: 'Empty page navigation', exact: true }),
    ).toHaveCount(0);
    const previousOnly = page.getByRole('navigation', { name: 'Previous page only', exact: true });
    const nextOnly = page.getByRole('navigation', { name: 'Next page only', exact: true });
    await expect(previousOnly.getByRole('link')).toHaveCount(1);
    await expect(nextOnly.getByRole('link')).toHaveCount(1);
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalOverflow(page);
      // one browser call keeps both boxes in the same frame during viewport scroll restoration
      const [firstBox, nextBox] = await both.getByRole('link').evaluateAll((links) =>
        links.map((link) => {
          const { x, y, width, height } = link.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
      if (firstBox === undefined || nextBox === undefined)
        throw new Error('Adjacent page navigation is missing.');
      if (width === 320) expect(firstBox.y + firstBox.height).toBeLessThanOrEqual(nextBox.y);
      else {
        expect(firstBox.x + firstBox.width).toBeLessThanOrEqual(nextBox.x);
        const previousTitleOffset = await previous
          .getByText('Shared foundations', { exact: true })
          .evaluate((title) => {
            const link = title.closest('a');
            if (link === null) throw new Error('The previous title has no link.');
            return title.getBoundingClientRect().top - link.getBoundingClientRect().top;
          });
        const nextTitleOffset = await next
          .getByText('Technical examples with a deliberately long title', { exact: true })
          .evaluate((title) => {
            const link = title.closest('a');
            if (link === null) throw new Error('The next title has no link.');
            return title.getBoundingClientRect().top - link.getBoundingClientRect().top;
          });
        expect(previousTitleOffset).toBe(nextTitleOffset);
        expect(
          await previousOnly.evaluate((navigation) => {
            const link = navigation.querySelector('a');
            if (link === null) throw new Error('The previous link is missing.');
            return link.getBoundingClientRect().left - navigation.getBoundingClientRect().left;
          }),
        ).toBe(0);
        expect(
          await nextOnly.evaluate((navigation) => {
            const link = navigation.querySelector('a');
            if (link === null) throw new Error('The next link is missing.');
            return navigation.getBoundingClientRect().right - link.getBoundingClientRect().right;
          }),
        ).toBe(0);
      }
    }
    expect(
      (await new AxeBuilder({ page }).include('[data-example="page-navigation"]').analyze())
        .violations,
    ).toStrictEqual([]);
    await next.focus();
    await next.press('Enter');
    await expect(page).toHaveURL('/technical-content/');
  });
}
