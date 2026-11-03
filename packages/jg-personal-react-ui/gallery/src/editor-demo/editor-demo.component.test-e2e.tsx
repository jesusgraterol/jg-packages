import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  installFakeMicrophone,
  waitForRecordedAudio,
} from 'jg-playwright';

import { useFirefoxCaptureDevice } from '../recording/recording.test-utils.js';

/** Records unexpected browser failures while allowing the deliberately failed local adapter request. */
const trackEditorErrors = (page: Page, errors: Array<Error | string>): void => {
  page.on('pageerror', (error) => errors.push(error));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.text().includes('503') && message.location().url.includes('/route-ready.txt'))
      return;
    errors.push(message.text());
  });
};

/** The contrast ratio of two opaque sRGB colors, as WCAG defines it. */
const contrastRatio = (first: number[], second: number[]): number => {
  const luminance = ([red, green, blue]: number[]): number => {
    const [r, g, b] = [red!, green!, blue!].map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
};

for (const theme of ['light', 'dark'] as const) {
  test(
    `${theme} rich document keeps long tokens, tables, code and video authoring inside a phone`,
    { tag: '@full' },
    async ({ browser, browserName }, testInfo) => {
      const errors: Array<Error | string> = [];
      const context = await browser.newContext({
        viewport: { width: 320, height: 480 },
        hasTouch: true,
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        trackEditorErrors(page, errors);
        if (browserName === 'chromium') {
          const devtools = await context.newCDPSession(page);
          await devtools.send('Emulation.setSafeAreaInsetsOverride', {
            insets: { top: 32, bottom: 24, left: 12, right: 12 },
          });
        }
        let playerCount = 0;
        await page.route('https://www.youtube-nocookie.com/**', (route) => {
          playerCount += 1;
          return route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><html lang="en"><title>Video preview</title><main aria-label="Player preview ${playerCount}">Local player preview</main></html>`,
          });
        });
        await page.goto(`http://127.0.0.1:4178/editors?theme=${theme}`);
        await page.getByRole('button', { name: 'Load rich document', exact: true }).click();
        const notes = page.getByRole('textbox', { name: 'Project notes', exact: true });
        await expect(notes).toContainText('Release checklist');
        await notes.locator('.milkdown-code-block').scrollIntoViewIfNeeded();
        await expect(notes.locator('.cm-content')).toContainText('const releasePath');
        await expect(notes.getByRole('table')).toBeVisible();
        await notes
          .getByRole('img', { name: 'Project mark', exact: true })
          .scrollIntoViewIfNeeded();
        await expect(notes.getByRole('img', { name: 'Project mark', exact: true })).toBeVisible();
        const height = notes.getByRole('spinbutton', {
          name: 'Image height in pixels',
          exact: true,
        });
        await expect(height).toBeVisible();
        await expect(height).toHaveValue('128');
        await height.focus();
        await height.press('ArrowUp');
        await expect(height).toHaveValue('129');
        await height.press('Enter');
        await expect(notes.getByRole('img', { name: 'Project mark', exact: true })).toHaveCSS(
          'height',
          '129px',
        );
        await expect(height).toHaveCSS('font-size', '16px');
        await expect(height).toHaveCSS('height', '44px');
        await expect(height).toHaveCSS('border-top-style', 'solid');
        const imageBounds = await notes
          .getByRole('img', { name: 'Project mark', exact: true })
          .boundingBox();
        const fieldBounds = await height.boundingBox();
        expect(fieldBounds!.y).toBeGreaterThanOrEqual(imageBounds!.y + imageBounds!.height);
        await expect(
          notes.getByRole('textbox', { name: 'typescript code editor', exact: true }),
        ).toHaveCSS('font-size', '16px');
        await expectNoHorizontalOverflow(page);
        const codeScroll = notes.locator('.cm-scroller');
        expect(
          await codeScroll.evaluate((element) => element.scrollWidth > element.clientWidth),
        ).toBe(true);
        const inlineBounds = await notes
          .locator('p code')
          .first()
          .evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const owner = element.closest('[role="textbox"]')!.getBoundingClientRect();
            return {
              right: owner.right,
              textRight: Math.max(...Array.from(range.getClientRects(), (rect) => rect.right)),
            };
          });
        expect(inlineBounds.textRight).toBeLessThanOrEqual(inlineBounds.right + 1);
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        const editVideo = notes.getByRole('button', { name: 'Edit YouTube video', exact: true });
        await editVideo.scrollIntoViewIfNeeded();
        await editVideo.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Edit YouTube video', exact: true });
        await expect(
          dialog.getByRole('textbox', { name: 'YouTube URL', exact: true }),
        ).toBeFocused();
        await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(editVideo).toBeFocused();
        if (testInfo.project.name === 'chromium' && testInfo.repeatEachIndex === 0)
          await page.screenshot({
            path: testInfo.outputPath(`rich-editor-${theme}.png`),
            fullPage: true,
          });
      } finally {
        await context.close();
        expect(errors).toStrictEqual([]);
      }
    },
  );
  test(
    `${theme} tablet editor insertion controls retain coarse-pointer target sizes`,
    { tag: '@full' },
    async ({ browser }) => {
      const errors: Array<Error | string> = [];
      const context = await browser.newContext({
        viewport: { width: 768, height: 640 },
        hasTouch: true,
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        trackEditorErrors(page, errors);
        await page.goto(`http://127.0.0.1:4178/editors?theme=${theme}`);
        const notes = page.getByRole('textbox', { name: 'Project notes', exact: true });
        await expect(notes).toBeEditable();
        await notes.focus();
        await notes.press('ControlOrMeta+a');
        await notes.press('Backspace');
        await expect(notes).toHaveText('');
        const insert = page.getByRole('button', { name: 'Insert block', exact: true });
        await expect(insert).toBeVisible();
        const box = await insert.evaluate((element) => ({
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        }));
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        await insert.click();
        const video = page.getByText('YouTube video', { exact: true });
        await expect(video).toBeVisible();
        const rowHeight = await video.evaluate(
          (element) => element.closest('li')!.getBoundingClientRect().height,
        );
        expect(rowHeight).toBeGreaterThanOrEqual(44);
      } finally {
        await context.close();
        expect(errors).toStrictEqual([]);
      }
    },
  );
  test(
    `${theme} phone editor retains formatting and drafts across layouts`,
    { tag: '@full' },
    async ({ browser }, testInfo) => {
      const errors: Array<Error | string> = [];
      const context = await browser.newContext({
        viewport: { width: 320, height: 480 },
        hasTouch: true,
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        trackEditorErrors(page, errors);
        await page.goto(`http://127.0.0.1:4178/editors?theme=${theme}`);
        const documentSection = page.getByRole('region', {
          name: 'Document authoring',
          exact: true,
        });
        const notes = documentSection.getByRole('textbox', { name: 'Project notes', exact: true });
        await expect(notes).toHaveText('Weekly notesReview {{PROJECT_NAME}} before release.');
        await notes.fill('Weekly plan');
        await notes.press('ControlOrMeta+a');
        await notes.press('ControlOrMeta+b');
        await documentSection.getByRole('button', { name: 'wide', exact: true }).click();
        await expect(notes.locator('strong')).toHaveText('Weekly plan');
        await documentSection.getByText('Serialized document', { exact: true }).first().click();
        await expect(
          documentSection.getByLabel('Serialized document', { exact: true }),
        ).toContainText('**Weekly plan**');
        const token = `/workspace/${'unbroken-command'.repeat(32)}`;
        await notes.fill(token);
        await documentSection.getByRole('button', { name: 'compact', exact: true }).click();
        await expect(notes).toHaveText(token);
        await expectNoHorizontalOverflow(page);
        const textBounds = await notes.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return {
            edge: element.getBoundingClientRect().right,
            maxTextEdge: Math.max(...Array.from(range.getClientRects(), (rect) => rect.right)),
          };
        });
        expect(textBounds.maxTextEdge).toBeLessThanOrEqual(textBounds.edge + 1);
        const message = page.getByRole('textbox', { name: 'Message', exact: true });
        await message.fill('Latest unsaved message');
        await message.press('ControlOrMeta+Enter');
        await expect(
          page.getByRole('status', { name: 'Submitted message', exact: true }),
        ).toContainText('Latest unsaved message');
        await expect(message).toHaveText('');
        await message.fill('Latest unsaved message');
        const format = page.getByRole('button', { name: 'Format message', exact: true });
        await format.focus();
        await page.keyboard.press('Enter');
        const heading = page.getByRole('menuitem', { name: 'Heading 2', exact: true });
        await expect(heading).toBeVisible();
        await heading.click();
        await expect(message.locator('h2')).toHaveText('Latest unsaved message');
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        if (testInfo.project.name === 'chromium' && testInfo.repeatEachIndex === 0)
          await page.screenshot({
            path: testInfo.outputPath(`editor-${theme}.png`),
            fullPage: true,
          });
        await page.getByRole('link', { name: 'Back to gallery', exact: true }).click();
        await expect(
          page.getByRole('heading', { name: 'Shared components. Personal by design.' }),
        ).toBeVisible();
      } finally {
        await context.close();
        expect(errors).toStrictEqual([]);
      }
    },
  );

  test(
    `${theme} selected text in the chat editor stays readable`,
    { tag: '@full' },
    async ({ page }) => {
      await page.goto(`/editors?theme=${theme}`);
      const message = page.getByRole('textbox', { name: 'Message', exact: true });
      await expect(message).toBeEditable();
      await message.click();
      await page.keyboard.type('Selected words stay readable');
      await message.press('ControlOrMeta+a');
      // the selection's color, laid over the surface behind the editor, against the text's color
      const colors = await message.evaluate((editor) => {
        const toRgba = (css: string): number[] => {
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          const context = canvas.getContext('2d')!;
          context.fillStyle = css;
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data];
        };
        const paragraph = editor.querySelector('p')!;
        let surface = 'rgb(255, 255, 255)';
        for (let element: Element | null = editor; element; element = element.parentElement) {
          const color = toRgba(getComputedStyle(element).backgroundColor);
          if (color[3] === 255) {
            surface = getComputedStyle(element).backgroundColor;
            break;
          }
        }
        return {
          selection: toRgba(getComputedStyle(paragraph, '::selection').backgroundColor),
          text: toRgba(getComputedStyle(paragraph).color),
          surface: toRgba(surface),
        };
      });
      const alpha = colors.selection[3]! / 255;
      const selected = colors.selection
        .slice(0, 3)
        .map((channel, index) => channel * alpha + colors.surface[index]! * (1 - alpha));
      expect(contrastRatio(selected, colors.text)).toBeGreaterThanOrEqual(4.5);
      // and the selection still shows against the surface
      expect(contrastRatio(selected, colors.surface)).toBeGreaterThan(1.15);
    },
  );

  test(
    `${theme} attachments recover from provider failure and insert literal chat text`,
    { tag: '@full' },
    async ({ page }) => {
      const errors: Array<Error | string> = [];
      trackEditorErrors(page, errors);
      await page.setViewportSize({ width: 320, height: 480 });
      let shouldFail = true;
      await page.route('**/route-ready.txt?input=*', (route) =>
        route.fulfill({ status: shouldFail ? 503 : 200, body: 'ready' }),
      );
      await page.goto(`/editors?theme=${theme}`);
      const message = page.getByRole('textbox', { name: 'Message', exact: true });
      await expect(
        page.getByRole('textbox', { name: 'Project notes', exact: true }),
      ).toBeEditable();
      await expect(message).toBeEditable();
      await page.getByRole('button', { name: 'Attach notes', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Attach notes', exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel('Upload files', { exact: true }).setInputFiles({
        name: 'release-notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('notes'),
      });
      await expect(
        dialog.getByText('The input service is unavailable. Try again.', { exact: true }),
      ).toBeVisible();
      shouldFail = false;
      await dialog.getByRole('button', { name: /Retry/ }).click();
      await expect(dialog.getByRole('button', { name: 'Submit', exact: true })).toBeEnabled();
      await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(message).toContainText('Attachment: release-notes.txt');
      await page.getByRole('button', { name: 'Submit message', exact: true }).click();
      await expect(
        page.getByRole('status', { name: 'Submitted message', exact: true }),
      ).toContainText('Attachment: release-notes.txt');
      await expectNoHorizontalOverflow(page);
      expect(errors).toStrictEqual([]);
    },
  );

  for (const action of ['Transcribe', 'Send', 'Oversized Send'] as const) {
    test(
      theme + ' ' + action + ' keeps complete dictation and uses the ordinary message action',
      async ({ browser, browserName }, testInfo) => {
        const errors: Array<Error | string> = [];
        const context = await browser.newContext({
          viewport: { width: 320, height: 480 },
          hasTouch: true,
          colorScheme: theme,
          reducedMotion: 'reduce',
        });
        let releaseSend: (() => void) | undefined;
        try {
          const page = await context.newPage();
          trackEditorErrors(page, errors);
          if (browserName === 'chromium') {
            const devtools = await context.newCDPSession(page);
            await devtools.send('Emulation.setSafeAreaInsetsOverride', {
              insets: { top: 32, bottom: 24, left: 12, right: 12 },
            });
          }
          await installFakeMicrophone(page);
          let transcriptions = 0;
          let submissions = 0;
          const sendGate = new Promise<void>((resolve) => {
            releaseSend = resolve;
          });
          await page.route('**/route-ready.txt?input=*', async (route) => {
            const operation = new URL(route.request().url()).searchParams.get('input');
            if (operation === 'transcribe') transcriptions += 1;
            if (operation === 'send') {
              submissions += 1;
              await sendGate;
            }
            await route.fulfill({ body: 'ready' });
          });
          await page.goto('/editors?theme=' + theme);
          await useFirefoxCaptureDevice(page, browserName);
          const message = page.getByRole('textbox', { name: 'Message', exact: true });
          await expect(
            page.getByRole('textbox', { name: 'Project notes', exact: true }),
          ).toBeEditable();
          await expect(message).toBeEditable();
          if (action !== 'Send') await message.fill('Existing message');
          if (action === 'Oversized Send')
            await page
              .getByRole('button', { name: 'Use oversized transcript', exact: true })
              .click();
          const microphone = page.getByRole('button', { name: 'Open audio recorder', exact: true });
          // settle WebKit's contenteditable blur scroll before the pointer activation.
          await microphone.focus();
          await microphone.click();
          const dialog = page.getByRole('dialog', { name: 'Audio', exact: true });
          await expect(dialog).toBeVisible();
          if (await page.evaluate(() => typeof MediaRecorder === 'undefined')) {
            await expect(dialog.getByRole('alert')).toHaveText(
              'Audio recording is not supported in this browser.',
            );
            await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
            return;
          }
          await waitForRecordedAudio(page);
          const recorderAction = dialog.getByRole('button', {
            name: action === 'Transcribe' ? 'Transcribe' : 'Send',
            exact: true,
          });
          await recorderAction.focus();
          await recorderAction.click();
          const submitted = page.getByRole('status', { name: 'Submitted message', exact: true });
          if (action === 'Send') {
            await expect.poll(() => submissions).toBe(1);
            await expect(recorderAction).toBeFocused();
            await expect(recorderAction).toHaveAttribute('aria-disabled', 'true');
            await expect(dialog.locator('[data-slot="audio-input-action-progress"]')).toHaveCount(
              1,
            );
            await expect(dialog.locator('[data-slot="audio-input-action-progress"]')).toHaveCSS(
              'animation-name',
              'none',
            );
            await expect(
              dialog.getByRole('button', { name: 'Cancel', exact: true }),
            ).toBeDisabled();
            await page.keyboard.press('Escape');
            await expect(dialog).toBeVisible();
            await page.keyboard.press('Enter');
            expect(submissions).toBe(1);
            releaseSend?.();
            await expect(dialog).toHaveCount(0);
            await expect(submitted).toContainText('Review the deployment notes before sending.');
            await expect(message).toHaveText('');
            await message.focus();
            await message.press('ControlOrMeta+z');
            await expect(message).toHaveText('');
            await message.fill('Next message');
            await message.press('ControlOrMeta+Enter');
            await expect(submitted).toContainText('Next message');
            await expect(message).toHaveText('');
            expect(submissions).toBe(2);
          } else {
            await expect(dialog).toHaveCount(0);
            await expect(message).toBeFocused();
            await expect(message).toContainText('Existing message');
            expect(submissions).toBe(0);
            await expect(submitted).toHaveText('No message submitted.');
            if (action === 'Oversized Send') {
              await expect(message).toContainText('BEGIN café');
              await expect(message).toContainText('END');
              expect((await message.innerText()).length).toBeGreaterThan(45000);
              await expect(
                page.getByRole('button', { name: 'Submit message', exact: true }),
              ).toBeDisabled();
              await message.press('ControlOrMeta+Enter');
              expect(submissions).toBe(0);
              await message.fill('Shortened message');
            } else
              await expect(message).toContainText('Review the deployment notes before sending.');
            releaseSend?.();
            await page.getByRole('button', { name: 'Submit message', exact: true }).click();
            await expect(submitted).toContainText(
              action === 'Oversized Send' ? 'Shortened message' : 'Existing message',
            );
            await expect(message).toHaveText('');
            expect(submissions).toBe(1);
          }
          expect(transcriptions).toBe(1);
          await expectNoHorizontalOverflow(page);
          expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
          if (testInfo.project.name === 'chromium' && testInfo.repeatEachIndex === 0)
            await page.screenshot({
              path: testInfo.outputPath(
                'dictation-' + theme + '-' + action.toLowerCase().replaceAll(' ', '-') + '.png',
              ),
              fullPage: true,
            });
        } finally {
          releaseSend?.();
          await context.close();
          expect(errors).toStrictEqual([]);
        }
      },
    );
  }

  test(
    `${theme} reviewed dictation reaches the real chat controls after retry`,
    { tag: '@full' },
    async ({ browser, browserName }) => {
      const errors: Array<Error | string> = [];
      const context = await browser.newContext({
        viewport: { width: 320, height: 480 },
        hasTouch: true,
        colorScheme: theme,
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        trackEditorErrors(page, errors);
        await installFakeMicrophone(page);
        let shouldFail = true;
        await page.route('**/route-ready.txt?input=*', (route) =>
          route.fulfill({
            status:
              new URL(route.request().url()).searchParams.get('input') === 'send' && shouldFail
                ? 503
                : 200,
            body: 'ready',
          }),
        );
        await page.goto(`http://127.0.0.1:4178/editors?theme=${theme}`);
        await useFirefoxCaptureDevice(page, browserName);
        await expect(
          page.getByRole('textbox', { name: 'Project notes', exact: true }),
        ).toBeEditable();
        await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEditable();
        await page.getByRole('button', { name: 'Open audio recorder', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Audio', exact: true });
        if (await page.evaluate(() => typeof MediaRecorder === 'undefined')) {
          await expect(dialog.getByRole('alert')).toHaveText(
            'Audio recording is not supported in this browser.',
          );
          await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
          await expect(dialog).toHaveCount(0);
          return;
        }
        await waitForRecordedAudio(page);
        await dialog.getByRole('button', { name: 'Transcribe', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        const message = page.getByRole('textbox', { name: 'Message', exact: true });
        await expect(message).toContainText('Review the deployment notes before sending.');
        await message.fill('# Literal voice note');
        await page.getByRole('button', { name: 'Submit message', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Your message was not confirmed.');
        await expect(message).toContainText('# Literal voice note');
        shouldFail = false;
        await page.getByRole('button', { name: 'Submit message', exact: true }).click();
        await expect(
          page.getByRole('status', { name: 'Submitted message', exact: true }),
        ).toContainText('Literal voice note');
        await expect(message).toHaveText('');
        await expectNoHorizontalOverflow(page);
      } finally {
        await context.close();
        expect(errors).toStrictEqual([]);
      }
    },
  );
}
