import { expect, test as base } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

// touch scenarios own separate contexts; diagnostics must not create an unused default page.
const test = base.extend({
  page: async ({ page }, use, info) => {
    await use(page);
    if (info.status === info.expectedStatus || page.isClosed()) return;
    const focusState = await page.evaluate(() => ({
      hasFocus: document.hasFocus(),
      visibility: document.visibilityState,
      activeElement: {
        tag: document.activeElement?.tagName,
        id: document.activeElement?.id,
        role: document.activeElement?.getAttribute('role'),
        label: document.activeElement?.getAttribute('aria-label'),
      },
      menus: [...document.querySelectorAll('[data-slot="dropdown-menu-content"]')].map((menu) => ({
        animation: getComputedStyle(menu).animationName,
        transition: getComputedStyle(menu).transitionProperty,
      })),
    }));
    process.stderr.write(`Controls focus diagnostic: ${JSON.stringify(focusState)}\n`);
    await info.attach('focus-state', {
      body: JSON.stringify(focusState, null, 2),
      contentType: 'application/json',
    });
  },
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 1280]) {
    test(`controls retain validation, keyboard menus and text at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: (text: string) => {
              (window as typeof window & { jgCopiedText?: string }).jgCopiedText = text;
              return Promise.resolve();
            },
          },
        });
      });
      await page.goto(`/?theme=${theme}`);
      await page.bringToFront();
      const controls = page.getByRole('region', { name: 'Controls and composition', exact: true });
      await controls.getByRole('button', { name: 'Save workspace', exact: true }).click();
      await expect(controls.getByText('Enter a workspace name.', { exact: true })).toBeVisible();
      const name = controls.getByRole('textbox', { name: 'Workspace name', exact: true });
      await expect(name).toHaveAttribute('aria-invalid', 'true');
      await name.fill('Personal workspace with a long recognizable name');
      await controls.getByRole('button', { name: 'Save workspace', exact: true }).click();
      await expect(controls.getByRole('status', { name: 'Workspace save result' })).toHaveText(
        'Saved Personal workspace with a long recognizable name',
      );
      await name.focus();
      await expect(name).toBeFocused();
      expect(await name.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
        'none',
      );
      await controls.getByRole('combobox', { name: 'Storage location' }).click();
      await page.getByRole('option', { name: 'Shared workspace', exact: true }).click();
      await expect(controls.getByRole('combobox', { name: 'Storage location' })).toBeFocused();
      await expect(controls.getByText('Shared workspace', { exact: true })).toBeVisible();
      await expect(
        controls.getByRole('progressbar', { name: 'Sync progress', exact: true }),
      ).toHaveAttribute('aria-valuenow', '42');
      const overview = controls.getByRole('tab', { name: 'Workspace overview', exact: true });
      await overview.focus();
      await page.keyboard.press('ArrowRight');
      await expect(
        controls.getByRole('tab', { name: 'Recent session history', exact: true }),
      ).toBeFocused();
      await expect(controls.getByText('No sessions yet', { exact: true })).toBeVisible();
      if (theme === 'dark') {
        const commands = controls.getByRole('button', { name: 'Workspace commands', exact: true });
        await commands.hover();
        expect(await commands.evaluate((element) => getComputedStyle(element).color)).toBe(
          await page.locator('body').evaluate((element) => getComputedStyle(element).color),
        );
      }
      await controls.getByRole('button', { name: 'Workspace commands', exact: true }).focus();
      await page.keyboard.press('ArrowDown');
      const openCommand = page.getByRole('menuitem', { name: /^Open workspace/u });
      await expect(openCommand).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(controls.getByRole('status', { name: 'Workspace command result' })).toHaveText(
        'Workspace opened',
      );
      const menuTrigger = controls.getByRole('button', {
        name: 'Workspace commands',
        exact: true,
      });
      // verify restoration before activating the window; foregrounding must not repair DOM focus.
      await expect
        .poll(() =>
          menuTrigger.evaluate((trigger) => trigger.ownerDocument.activeElement === trigger),
        )
        .toBe(true);
      await page.bringToFront();
      await expect(
        controls.getByRole('button', { name: 'Workspace commands', exact: true }),
      ).toBeFocused();
      await controls.getByRole('button', { name: 'Workspace commands', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Keep menu open', exact: true }).click();
      await expect(page.getByRole('menu')).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expect(controls.getByRole('status', { name: 'Workspace command result' })).toHaveText(
        'Command cancelled',
      );
      await page.keyboard.press('Escape');
      await expect(
        controls.getByRole('button', { name: 'Workspace commands', exact: true }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(
        controls.getByRole('button', { name: 'Refresh preview', exact: true }),
      ).toBeFocused();
      await expect(page.getByText('Refresh workspace preview', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Enter');
      await expect(controls.getByRole('status', { name: 'Workspace command result' })).toHaveText(
        'Preview refreshed',
      );
      const copy = controls.getByRole('button', { name: 'Copy command', exact: true });
      await copy.focus();
      await page.keyboard.press('Enter');
      await expect(
        controls.getByRole('button', { name: 'Command copied', exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => (window as typeof window & { jgCopiedText?: string }).jgCopiedText,
        ),
      ).toBe('pnpm build');
      const table = page.getByRole('region', { name: 'Package responsibilities', exact: true });
      await table.focus();
      await expect(table).toBeFocused();
      expect(await table.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
        'none',
      );
      if (width === 320)
        expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
          true,
        );
      await expectNoHorizontalOverflow(page);
    });
  }

  base(
    `touch fields, label rows and reduced-height layout work in ${theme}`,
    async ({ browser }) => {
      const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 320, height: 480 },
        reducedMotion: 'reduce',
        colorScheme: theme,
      });
      try {
        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:4178/?theme=${theme}`);
        for (const role of ['Workspace name', 'Workspace notes'])
          await expect(page.getByRole('textbox', { name: role, exact: true })).toHaveCSS(
            'font-size',
            '16px',
          );
        const select = page.getByRole('combobox', { name: 'Storage location' });
        await expect(select).toHaveCSS('font-size', '16px');
        expect((await select.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        for (const label of [
          'Keep session history',
          'Daily sync',
          'Weekly sync',
          'Background sync',
        ]) {
          expect(
            (await page.getByText(label, { exact: true }).boundingBox())?.height,
          ).toBeGreaterThanOrEqual(44);
        }
        await page.getByText('Keep session history', { exact: true }).click();
        await expect(page.getByRole('checkbox', { name: 'Keep session history' })).toBeChecked();
        await page
          .getByRole('textbox', { name: 'Workspace notes' })
          .fill('Notes remain reachable with the keyboard viewport reduced.');
        const save = page.getByRole('button', { name: 'Save workspace', exact: true });
        await save.scrollIntoViewIfNeeded();
        await expect(save).toBeInViewport();
        for (const tab of await page.getByRole('tab').all())
          expect((await tab.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await page.getByRole('button', { name: 'Workspace commands', exact: true }).click();
        const item = page.getByRole('menuitemcheckbox', { name: 'Auto save', exact: true });
        expect((await item.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await expect(item).toHaveCSS('font-size', '16px');
        const menu = page.getByRole('menu');
        await expect(menu).toHaveCSS('overflow-y', 'auto');
        const bounds = await menu.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(480);
        await expectNoHorizontalOverflow(page);
        const lastCommand = page.getByRole('menuitem', { name: 'Keep menu open', exact: true });
        await lastCommand.scrollIntoViewIfNeeded();
        await expect(lastCommand).toBeInViewport();

        await page.keyboard.press('Escape');
        await expect(page.locator('[data-slot="progress-indicator"]').first()).toHaveCSS(
          'transition-property',
          'none',
        );
        await expect(page.getByRole('status', { name: 'Loading workspace' })).toHaveCSS(
          'animation-name',
          'none',
        );
        await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
          'content',
          /viewport-fit=cover/u,
        );
        await expectNoHorizontalOverflow(page);
      } finally {
        await context.close();
      }
    },
  );
}
