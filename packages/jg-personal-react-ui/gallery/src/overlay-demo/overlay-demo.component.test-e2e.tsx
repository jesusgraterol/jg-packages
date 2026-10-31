import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 1280]) {
    test(
      `dialog focus, nested decisions, busy dismissal and return work at ${width}px in ${theme}`,
      { tag: '@full' },
      async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/?theme=${theme}`);
        const trigger = page.getByRole('button', { name: 'Open small workspace', exact: true });
        await trigger.scrollIntoViewIfNeeded();
        const originalScroll = await page.evaluate(() => window.scrollY);
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: 'small workspace', exact: true });
        await expect(
          dialog.getByRole('textbox', { name: 'Workspace name', exact: true }),
        ).toBeFocused();
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
        await page.mouse.click(2, 2);
        await expect(dialog).toBeVisible();
        const nestedTrigger = dialog.getByRole('button', {
          name: 'Review archive decision',
          exact: true,
        });
        await nestedTrigger.click();
        const alert = page.getByRole('alertdialog', {
          name: 'Archive this workspace?',
          exact: true,
        });
        await expect(alert).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        await expect(
          alert.getByRole('button', { name: 'Close dialog', exact: true }),
        ).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(alert).toHaveCount(0);
        await expect(dialog).toBeVisible();
        await expect(nestedTrigger).toBeFocused();
        await dialog.getByRole('button', { name: 'Simulate pending save', exact: true }).click();
        await expect(
          dialog.getByRole('button', { name: 'Close dialog', exact: true }),
        ).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Finish pending save', exact: true }).click();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(originalScroll);
        await expectNoHorizontalOverflow(page);
      },
    );

    test(
      `drawers, confirmation and route return work at ${width}px in ${theme}`,
      { tag: '@full' },
      async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/?theme=${theme}`);
        const drawerTrigger = page.getByRole('button', {
          name: 'Open navigation drawer',
          exact: true,
        });
        await drawerTrigger.click();
        const drawer = page.getByRole('dialog', { name: 'Workspace navigation', exact: true });
        await expect(drawer).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        const links = drawer.getByRole('region', {
          name: 'Workspace navigation links',
          exact: true,
        });
        await expect(links).toHaveCSS('overscroll-behavior-y', 'contain');
        expect(await links.evaluate((element) => element.scrollHeight)).toBeGreaterThan(
          await links.evaluate((element) => element.clientHeight),
        );
        await drawer.getByRole('button', { name: 'Return to gallery', exact: true }).click();
        await expect(drawer).toHaveCount(0);
        await expect(drawerTrigger).toBeFocused();
        await page
          .getByRole('button', { name: 'Request destructive confirmation', exact: true })
          .click();
        const confirmation = page.getByRole('alertdialog', {
          name: 'Delete this item?',
          exact: true,
        });
        await expect(confirmation).toHaveAccessibleDescription('This action cannot be undone.');
        await expect(
          confirmation.getByRole('button', { name: 'Close dialog', exact: true }),
        ).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(confirmation).toHaveCount(0);
        await expect(
          page.getByRole('status', { name: 'Confirmation result', exact: true }),
        ).toHaveText('Deletion cancelled');
        await page
          .getByRole('button', { name: 'Request destructive confirmation', exact: true })
          .click();
        await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(confirmation).toHaveCount(0);
        await expect(
          page.getByRole('status', { name: 'Confirmation result', exact: true }),
        ).toHaveText('Deletion confirmed');
        await page.getByRole('button', { name: 'Open medium workspace', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'medium workspace', exact: true });
        await dialog
          .getByRole('link', { name: 'Navigate to workspace details', exact: true })
          .click();
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          'Personal workspace with a long recognizable project title',
        );
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        await page.goBack();
        await expect(
          page.getByRole('heading', { name: 'Dialogs and navigation', exact: true }),
        ).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await drawerTrigger.click();
        await drawer.getByRole('link', { name: 'Workspace details', exact: true }).click();
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          'Personal workspace with a long recognizable project title',
        );
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.getByRole('link', { name: 'Back to gallery', exact: true }).click();
        await expect(
          page.getByRole('heading', { name: 'Dialogs and navigation', exact: true }),
        ).toBeVisible();
      },
    );
  }

  test(
    `mobile page dialogs keep Back, focused fields and fixed actions usable in ${theme}`,
    { tag: '@full' },
    async ({ browser, browserName }) => {
      const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 320, height: 480 },
        reducedMotion: 'reduce',
        colorScheme: theme,
      });
      try {
        const page = await context.newPage();
        const devtools = browserName === 'chromium' ? await context.newCDPSession(page) : null;
        if (devtools !== null) {
          // exercises real env(safe-area-inset-*) values in Chromium's emulated viewport.
          await devtools.send('Emulation.setSafeAreaInsetsOverride', {
            insets: { top: 32, bottom: 24, left: 12, right: 12 },
          });
        }
        await page.goto(`http://127.0.0.1:4178/?theme=${theme}`);
        const trigger = page.getByRole('button', { name: 'Open large workspace', exact: true });
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: 'large workspace', exact: true });
        await expect(dialog).toHaveCSS('height', '480px');
        await expect(dialog).toHaveCSS('animation-name', 'none');
        if (devtools !== null) {
          await expect(dialog.locator('[data-slot="dialog-header"]')).toHaveCSS(
            'padding-top',
            '32px',
          );
          await expect(dialog.locator('[data-slot="dialog-footer"]')).toHaveCSS(
            'padding-bottom',
            '24px',
          );
        }
        await expect(
          dialog.getByRole('textbox', { name: 'Workspace name', exact: true }),
        ).toBeFocused();
        const back = dialog.getByRole('button', { name: 'Go back', exact: true });
        const save = dialog.getByRole('button', { name: 'Save workspace changes', exact: true });
        for (const control of [back, save]) {
          const bounds = await control.boundingBox();
          expect(bounds?.height).toBeGreaterThanOrEqual(44);
          expect(bounds?.width).toBeGreaterThanOrEqual(44);
        }
        const note = dialog.getByRole('textbox', { name: 'Final note', exact: true });
        await note.scrollIntoViewIfNeeded();
        await note.click();
        await note.fill('The submit action stays visible above the home indicator.');
        await expect(note).toBeFocused();
        await expect(note).toHaveCSS('font-size', '16px');
        const footerBounds = await save.boundingBox();
        const fieldBounds = await note.boundingBox();
        expect(fieldBounds?.y).toBeGreaterThanOrEqual(0);
        expect((fieldBounds?.y ?? 0) + (fieldBounds?.height ?? 0)).toBeLessThanOrEqual(
          footerBounds?.y ?? 0,
        );
        expect((footerBounds?.y ?? 0) + (footerBounds?.height ?? 0)).toBeLessThanOrEqual(
          devtools === null ? 480 : 456,
        );
        await expectNoHorizontalOverflow(page);
        await save.click();
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await page.getByRole('button', { name: 'Open navigation drawer', exact: true }).click();
        const drawer = page.getByRole('dialog', { name: 'Workspace navigation', exact: true });
        if (devtools !== null) {
          await expect(drawer.locator('[data-slot="drawer-header"]')).toHaveCSS(
            'padding-top',
            '32px',
          );
          await expect(drawer.locator('[data-slot="drawer-footer"]')).toHaveCSS(
            'padding-bottom',
            '24px',
          );
        }
        await expect(drawer).toHaveCSS('transition-property', 'none');
        await page.keyboard.press('Escape');
        await expect(drawer).toHaveCount(0);
        for (const corner of ['start', 'end'] as const) {
          await page
            .getByRole('button', { name: 'Request destructive confirmation', exact: true })
            .click();
          const confirmation = page.getByRole('alertdialog', {
            name: 'Delete this item?',
            exact: true,
          });
          const close = confirmation.getByRole('button', { name: 'Close dialog', exact: true });
          const bounds = await close.boundingBox();
          if (bounds === null) throw new Error('The confirmation close target is not visible.');
          expect(bounds.width).toBeGreaterThanOrEqual(44);
          expect(bounds.height).toBeGreaterThanOrEqual(44);
          await page.touchscreen.tap(
            corner === 'start' ? bounds.x + 1 : bounds.x + bounds.width - 1,
            corner === 'start' ? bounds.y + 1 : bounds.y + bounds.height - 1,
          );
          await expect(confirmation).toHaveCount(0);
        }
        await expect(
          page.getByRole('status', { name: 'large workspace result', exact: true }),
        ).toHaveText('Workspace saved');
        await trigger.click();
        await back.click();
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
      } finally {
        await context.close();
      }
    },
  );
}
