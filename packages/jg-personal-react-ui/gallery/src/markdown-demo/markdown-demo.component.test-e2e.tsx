import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} 320px agent prose fits inside clipped flex and grid ancestors`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 640 },
      hasTouch: true,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.route('https://www.youtube-nocookie.com/embed/**', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html lang="en"><head><title>Video preview</title></head><body><main aria-label="Video preview">Video preview.</main></body></html>',
        }),
      );
      await page.goto(`http://127.0.0.1:4178/markdown?theme=${theme}`);
      for (const layout of ['flex', 'grid']) {
        const message = page.getByRole('article', { name: `${layout} agent message` });
        const metrics = await message.evaluate((article) => {
          const clip = article.parentElement;
          if (!clip) throw new Error('The message clip ancestor is missing.');
          const edge = clip.getBoundingClientRect().right;
          const textRects: DOMRect[] = [];
          const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
          let text = walker.nextNode();
          while (text) {
            if (text.textContent?.trim()) {
              const range = document.createRange();
              range.selectNodeContents(text);
              textRects.push(...range.getClientRects());
            }
            text = walker.nextNode();
          }
          return {
            edge,
            articleRight: article.getBoundingClientRect().right,
            maxTextRight: Math.max(...textRects.map((rect) => rect.right)),
            inlineWrap: getComputedStyle(article.querySelector('code')!).overflowWrap,
          };
        });
        expect(metrics.articleRight).toBeLessThanOrEqual(metrics.edge + 1);
        expect(metrics.maxTextRight).toBeLessThanOrEqual(metrics.edge + 1);
        expect(metrics.inlineWrap).toBe('anywhere');
      }
      await expectNoHorizontalOverflow(page);
      await page.getByRole('button', { name: 'Show more', exact: true }).first().click();
      await expect(page.getByText('Message end.', { exact: true })).toHaveCount(2);
      for (const layout of ['flex', 'grid']) {
        const message = page.getByRole('article', { name: `${layout} agent message` });
        const region = message.getByRole('group', { name: 'Scrollable table' });
        await expect(region).toBeVisible();
        expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
          true,
        );
        await region.focus();
        await expect(region).toBeFocused();
        expect(
          await region.evaluate(
            (element) =>
              element.getBoundingClientRect().right <=
              (element.closest('article')?.getBoundingClientRect().right ?? 0) + 1,
          ),
        ).toBe(true);
      }
      await expectNoHorizontalOverflow(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      await page.getByRole('button', { name: 'Collapse message', exact: true }).first().click();
      await expect(page.getByText('Message end.', { exact: true })).toHaveCount(0);
      const documentSection = page.getByRole('region', { name: 'Document rendering' });
      await expect(documentSection.getByText('{{PROJECT_NAME}}', { exact: true })).toBeVisible();
      const image = documentSection.getByRole('img', { name: 'JG mark', exact: true });
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (element) =>
              (element as HTMLImageElement).complete &&
              (element as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
      expect((await image.boundingBox())?.width).toBe(64);
      const video = documentSection.locator('iframe');
      await expect(video).toHaveAttribute(
        'src',
        'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
      );
      await expect(video).toHaveAttribute('title', 'Walkthrough');
      expect(
        await video.evaluate(
          (element) =>
            element.getBoundingClientRect().right <=
            (element.closest('section')?.getBoundingClientRect().right ?? 0) + 1,
        ),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      if (testInfo.project.name === 'chromium' && testInfo.repeatEachIndex === 0)
        await page.screenshot({
          path: testInfo.outputPath(`markdown-${theme}.png`),
          fullPage: true,
        });
      await page.getByRole('link', { name: 'Back to gallery' }).click();
      await expect(
        page.getByRole('heading', { name: 'Shared components. Personal by design.' }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} source controls support keyboard wrapping and 44px touch targets`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 480 },
      hasTouch: true,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.route('https://www.youtube-nocookie.com/embed/**', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html lang="en"><head><title>Video preview</title></head><body><main aria-label="Video preview">Video preview.</main></body></html>',
        }),
      );
      await page.goto(`http://127.0.0.1:4178/markdown?theme=${theme}`);
      const source = page.getByRole('region', { name: 'Source preferences', exact: true });
      const pre = source.locator('pre').first();
      await pre.scrollIntoViewIfNeeded();
      expect(await pre.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      await pre.focus();
      await pre.press('ArrowRight');
      await expect.poll(() => pre.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      const wrap = source
        .getByRole('button', { name: 'Line wrapping: Scroll', exact: true })
        .first();
      await wrap.focus();
      await expect(wrap).toBeFocused();
      expect(
        await wrap.evaluate((element) => element.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(44);
      expect(await wrap.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
        'none',
      );
      await wrap.press('Enter');
      const option = page.getByRole('menuitemradio', { name: 'Wrap lines', exact: true });
      await expect(option).toBeVisible();
      await option.press('Enter');
      await expect(
        source.getByRole('button', { name: 'Line wrapping: Wrap', exact: true }).first(),
      ).toBeVisible();
      expect(await pre.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
        true,
      );
      expect(
        await source
          .getByRole('button', { name: 'Copy to Clipboard', exact: true })
          .first()
          .evaluate((element) => element.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(44);
      const syntax = await pre.evaluate((element) => {
        const keyword = [...element.querySelectorAll('span')].find(
          (token) => token.textContent === 'const',
        );
        if (!keyword) throw new Error('The keyword syntax token is missing.');
        const reference = document.createElement('span');
        reference.style.color = 'var(--jg-syntax-token-keyword)';
        element.appendChild(reference);
        try {
          return {
            token: getComputedStyle(keyword).color,
            brand: getComputedStyle(reference).color,
          };
        } finally {
          reference.remove();
        }
      });
      expect(syntax.token).toBe(syntax.brand);
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}
