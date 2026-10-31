import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} diff folds work by keyboard and revisions retain word highlights`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/diff?theme=${theme}`);
    const source = page.getByRole('region', { name: 'JG source changes' });
    const folds = source.getByRole('button', { name: /Show \d+ unchanged lines/ });
    await expect(folds).toHaveCount(2);
    await folds.first().focus();
    await page.keyboard.press('Enter');
    await expect(source.getByText('// context line 0', { exact: true }).first()).toBeVisible();
    await folds.first().focus();
    await page.keyboard.press('Space');
    await expect(source.getByText('// final line 7', { exact: true }).first()).toBeVisible();
    await expect(source.getByRole('button', { name: 'Fold all unchanged lines' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await source.getByRole('button', { name: 'Update revision' }).click();
    await expect(source.locator('ins')).toHaveText('3');
    await expect(source.locator('del')).toHaveText('4');
    // the retained viewer preserves expanded blocks across content revisions.
    const foldAll = source.getByRole('button', { name: 'Fold all unchanged lines' });
    await foldAll.focus();
    await page.keyboard.press('Enter');
    const expandAll = source.getByRole('button', { name: 'Expand all unchanged lines' });
    await expect(expandAll).toHaveAttribute('aria-expanded', 'false');
    await expect(folds).toHaveCount(2);
    await expandAll.focus();
    await page.keyboard.press('Enter');
    await expect(source.getByRole('button', { name: 'Fold all unchanged lines' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await source.getByRole('button', { name: 'Code diff view: Split' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Unified', exact: true }).click();
    await expect(source.locator('[data-code-diff-view]')).toHaveAttribute(
      'data-code-diff-view',
      'unified',
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
    if (testInfo.project.name === 'chromium' && testInfo.repeatEachIndex === 0) {
      await page.screenshot({ path: testInfo.outputPath(`diff-${theme}.png`), fullPage: true });
    }
  });

  test(`${theme} 320px diff wraps long tokens and uses the independent consumer theme`, async ({
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
      await page.goto(`http://127.0.0.1:4178/diff?theme=${theme}`);
      const source = page.getByRole('region', { name: 'JG source changes' });
      await expect(source.locator('[data-code-diff-view]')).toHaveAttribute(
        'data-code-diff-view',
        'unified',
      );
      await expect(source.getByRole('button', { name: /Code diff view/ })).toHaveCount(0);
      for (const button of await source.getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
      const longSource = page.getByRole('region', { name: 'Long source lines' });
      const changedCell = longSource.getByRole('cell').filter({ has: page.locator('ins') });
      expect(await changedCell.evaluate((cell) => cell.scrollWidth <= cell.clientWidth + 1)).toBe(
        true,
      );
      const generic = page.getByRole('region', { name: 'Consumer-owned theme' });
      const colors = await generic.evaluate((element) => ({
        own: getComputedStyle(element).getPropertyValue('--background').trim(),
        global: getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
      }));
      expect(colors.own).not.toBe(colors.global);
      const roles = await generic.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          mono: style.getPropertyValue('--jg-ui-font-mono').trim(),
          surfaceShadow: style.getPropertyValue('--jg-ui-shadow-surface').trim(),
          keyword: style.getPropertyValue('--syntax-token-keyword').trim(),
          foreground: style.getPropertyValue('--foreground').trim(),
        };
      });
      expect(roles.mono).toBe('ui-monospace, monospace');
      expect(roles.surfaceShadow).toBe('none');
      expect(roles.keyword).toBe(roles.foreground);
      await expectNoHorizontalOverflow(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      if (testInfo.project.name === 'chromium' && testInfo.repeatEachIndex === 0) {
        await page.screenshot({
          path: testInfo.outputPath(`diff-phone-${theme}.png`),
          fullPage: true,
        });
      }
    } finally {
      await context.close();
    }
  });
}
