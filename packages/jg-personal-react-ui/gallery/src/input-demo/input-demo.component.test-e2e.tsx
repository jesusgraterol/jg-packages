import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  installFakeMicrophone,
  waitForRecordedAudio,
} from 'jg-playwright';

declare global {
  interface Window {
    // tracks captured by this private browser scenario, never application state.
    __jgInputTracks?: MediaStreamTrack[];
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} phone uploads preserve long filenames and recover from a private provider failure`, async ({
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
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let fail = true;
      await page.route('**/route-ready.txt?input=*', async (route) => {
        await route.fulfill({
          status: fail ? 503 : 200,
          body: fail ? 'PRIVATE UPLOAD DIAGNOSTICS' : 'ready',
        });
      });
      await page.goto(`http://127.0.0.1:4178/inputs?theme=${theme}`);
      const section = page.getByRole('region', { name: 'Attachments', exact: true });
      const fileName = `deployment-${'unbrokenpath'.repeat(16)}.txt`;
      await section.getByLabel('Attach files', { exact: true }).setInputFiles({
        name: fileName,
        mimeType: 'text/plain',
        buffer: Buffer.from('deployment notes'),
      });
      await expect(
        section.getByText('The input service is unavailable. Try again.', { exact: true }),
      ).toBeVisible();
      await expect(section).not.toContainText('PRIVATE UPLOAD');
      await expect(section.getByText(fileName, { exact: true })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      fail = false;
      await section.getByRole('button', { name: /Retry/ }).click();
      await expect(page.getByRole('status', { name: 'Latest upload', exact: true })).toHaveText(
        fileName,
      );
      await expect(
        section.getByText('The input service is unavailable. Try again.', { exact: true }),
      ).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      const statusColors = await section
        .getByText('Uploaded', { exact: true })
        .evaluate((status) => {
          const icon = status.parentElement?.querySelector('svg');
          if (icon === null || icon === undefined)
            throw new Error('The uploaded status icon was not rendered.');
          const reference = document.createElement('span');
          reference.style.color = 'var(--jg-primary)';
          status.appendChild(reference);
          try {
            return {
              icon: getComputedStyle(icon).color,
              primary: getComputedStyle(reference).color,
            };
          } finally {
            reference.remove();
          }
        });
      expect(statusColors.icon).toBe(statusColors.primary);
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      if (testInfo.project.name === 'chromium' && testInfo.repeatEachIndex === 0)
        await page.screenshot({ path: testInfo.outputPath('inputs.png'), fullPage: true });
      const browse = section.getByRole('button', { name: /Show upload area/ });
      await browse.focus();
      await expect(browse).toBeFocused();
      expect(
        await browse.evaluate((element) => element.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(44);
      await page.getByRole('link', { name: 'Back to gallery' }).click();
      await expect(
        page.getByRole('heading', { name: 'Shared components. Personal by design.' }),
      ).toBeVisible();
      expect(errors).toStrictEqual([]);
    } finally {
      await context.close();
    }
  });

  test(`${theme} dialog finalization retries without reuploading and image previews can be removed`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 480 });
    let failFinalize = true;
    let uploads = 0;
    await page.route('**/route-ready.txt?input=*', async (route) => {
      const operation = new URL(route.request().url()).searchParams.get('input');
      if (operation === 'upload') uploads += 1;
      await route.fulfill({
        status: operation === 'finalize' && failFinalize ? 503 : 200,
        body: 'ready',
      });
    });
    await page.goto(`/inputs?theme=${theme}`);
    await page.getByRole('button', { name: 'Add attachments', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add attachments', exact: true });
    await dialog
      .getByLabel('Upload files', { exact: true })
      .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') });
    await expect(dialog.getByRole('alert')).toContainText(
      'The input service is unavailable. Try again.',
    );
    failFinalize = false;
    await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status', { name: 'Finalized attachments' })).toHaveText(
      'notes.txt',
    );
    expect(uploads).toBe(1);
    const imageSection = page.getByRole('region', { name: 'Project image', exact: true });
    await imageSection.getByRole('button', { name: 'Choose image', exact: true }).click();
    const imageDialog = page.getByRole('dialog', { name: 'Upload image', exact: true });
    await imageDialog.getByLabel('Upload file', { exact: true }).setInputFiles({
      name: 'project.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT9sAAAAASUVORK5CYII=',
        'base64',
      ),
    });
    await expect(imageDialog).toHaveCount(0);
    const image = imageSection.locator('img');
    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
      .toBe(1);
    await imageSection.getByRole('button', { name: /Remove/ }).click();
    await expect(image).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
  });

  test(`${theme} real microphone encoding supports permission recovery, reviewed text, and send retry`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 480 },
      hasTouch: true,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await installFakeMicrophone(page, { rejectFirstRequest: true });
      let failSend = true;
      let transcriptions = 0;
      await page.route('**/route-ready.txt?input=*', async (route) => {
        const operation = new URL(route.request().url()).searchParams.get('input');
        if (operation === 'transcribe') transcriptions += 1;
        await route.fulfill({
          status: operation === 'send' && failSend ? 503 : 200,
          body: 'ready',
        });
      });
      await page.goto(`http://127.0.0.1:4178/inputs?theme=${theme}`);
      await page.evaluate(() => {
        const tracks: MediaStreamTrack[] = [];
        const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
          configurable: true,
          value: async (constraints?: MediaStreamConstraints) => {
            const stream = await getUserMedia(constraints);
            tracks.push(...stream.getTracks());
            return stream;
          },
        });
        window.__jgInputTracks = tracks;
      });
      const trigger = page.getByRole('button', { name: 'Open audio recorder', exact: true });
      await trigger.focus();
      await expect(trigger).toBeFocused();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Audio', exact: true });
      if (await page.evaluate(() => typeof MediaRecorder === 'undefined')) {
        await expect(dialog.getByRole('alert')).toHaveText(
          'Audio recording is not supported in this browser.',
        );
        await expect(
          dialog.getByRole('button', { name: 'Transcribe', exact: true }),
        ).toBeDisabled();
        await expectNoHorizontalOverflow(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        return;
      }
      await expect(dialog.getByRole('alert')).toContainText('Microphone access failed.');
      await dialog.getByRole('button', { name: 'Restart recording', exact: true }).click();
      await waitForRecordedAudio(page);
      const transforms = await dialog
        .locator('[data-slot="audio-input-waveform"]')
        .evaluate((waveform) =>
          Array.from(waveform.children).map((bar) => getComputedStyle(bar).transform),
        );
      expect(transforms.length).toBeGreaterThan(0);
      expect(transforms.every((transform) => transform === 'none')).toBe(true);
      await dialog.getByRole('button', { name: 'Transcribe', exact: true }).click();
      const editor = dialog.getByRole('textbox', { name: 'Transcription', exact: true });
      await expect(editor).toHaveValue('Review the deployment notes before sending.');
      expect(
        await page.evaluate(() => {
          const tracks = window.__jgInputTracks;
          if (tracks === undefined) throw new Error('The microphone observer was not installed.');
          return tracks.map((track) => track.readyState);
        }),
      ).toStrictEqual(['ended']);
      expect(
        await editor.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
      ).toBeGreaterThanOrEqual(16);
      await editor.fill('Reviewed voice note');
      await dialog.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(dialog.getByRole('alert')).toContainText(
        'The input service is unavailable. Try again.',
      );
      await expectNoHorizontalOverflow(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      if (testInfo.project.name === 'chromium' && testInfo.repeatEachIndex === 0)
        await page.screenshot({ path: testInfo.outputPath('dictation.png'), fullPage: true });
      failSend = false;
      await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('status', { name: 'Sent transcription' })).toHaveText(
        'Reviewed voice note',
      );
      expect(transcriptions).toBe(1);
      await page.getByRole('button', { name: 'Open audio recorder', exact: true }).click();
      await waitForRecordedAudio(page);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect(
        await page.evaluate(() => {
          const tracks = window.__jgInputTracks;
          if (tracks === undefined) throw new Error('The microphone observer was not installed.');
          return tracks.map((track) => track.readyState);
        }),
      ).toStrictEqual(['ended', 'ended']);
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
}
