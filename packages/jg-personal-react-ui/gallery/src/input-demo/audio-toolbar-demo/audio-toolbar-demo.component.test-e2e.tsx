import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, installFakeMicrophone } from 'jg-playwright';

import { useFirefoxCaptureDevice } from '../../recording/recording.test-utils.js';

declare global {
  interface Window {
    // native recording remains real; only the capacity event is controlled for this scenario.
    __jgToolbarRecorder?: MediaRecorder;
    __jgReleaseToolbarPermission?: () => void;
  }
}

for (const width of [320, 390, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} ${width}px recorder keeps its controls still through warning and restart @full`, async ({
      browser,
      browserName,
    }, testInfo) => {
      const context = await browser.newContext({
        viewport: { width, height: width < 640 ? 720 : 960 },
        hasTouch: width < 640,
        colorScheme: theme,
        reducedMotion: theme === 'light' ? 'reduce' : 'no-preference',
      });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await installFakeMicrophone(page);
        await page.addInitScript(() => {
          if (typeof MediaRecorder === 'undefined') return;
          const NativeRecorder = MediaRecorder;
          window.MediaRecorder = class extends NativeRecorder {
            constructor(stream: MediaStream, options?: MediaRecorderOptions) {
              super(stream, options);
              window.__jgToolbarRecorder = this;
            }
          };
        });
        await page.goto(`/inputs?theme=${theme}`);
        await page.evaluate(() => document.fonts.ready);
        await useFirefoxCaptureDevice(page, browserName, false);
        const section = page.getByRole('region', { name: 'Composer recording' });
        const trigger = section.getByRole('button', { name: 'Record message' });
        const closedHeight = (await trigger.boundingBox())!.height;
        await trigger.click();
        if (await page.evaluate(() => typeof MediaRecorder === 'undefined')) {
          await expect(page.getByRole('dialog', { name: 'Recording error' })).toBeVisible();
          return;
        }
        const row = section.getByRole('group', { name: 'Audio recording' });
        const status = row.getByRole('status').filter({ hasText: 'Recording' });
        await expect(status).toHaveText('Recording');
        await expect(row.getByText(/Limit \d+%/)).toHaveCount(0);
        const restart = row.getByRole('button', { name: 'Restart recording' });
        const send = row.getByRole('button', { name: 'Send', exact: true });
        const initial = await row.boundingBox();
        expect(initial!.height).toBe(closedHeight);
        const initialRestart = await restart.boundingBox();
        const initialSend = await send.boundingBox();
        const meter = row.locator('[data-slot="audio-input-toolbar-meter"]');
        const geometry = await meter.evaluate((element) => {
          const timer = element.querySelector('[data-slot="audio-input-elapsed"]')!;
          const wave = element.querySelector('[data-slot="audio-input-waveform"]')!;
          const firstBar = wave.firstElementChild!.getBoundingClientRect();
          const lastBar = wave.lastElementChild!.getBoundingClientRect();
          return {
            gap: timer.getBoundingClientRect().left - wave.getBoundingClientRect().right,
            waveHeight: wave.getBoundingClientRect().height,
            visibleWaveWidth: lastBar.right - firstBar.left,
            dotWidth: element
              .querySelector('[data-slot="audio-input-live-indicator"]')!
              .getBoundingClientRect().width,
          };
        });
        expect(geometry.gap).toBeLessThanOrEqual(12);
        expect(geometry.waveHeight).toBe(24);
        expect(geometry.dotWidth).toBeGreaterThan(0);
        if (width >= 390) expect(geometry.visibleWaveWidth).toBeGreaterThan(60);
        if (width === 390) {
          await page.setViewportSize({ width: 414, height: 720 });
          const wave = meter.locator('[data-slot="audio-input-waveform"]');
          await expect
            .poll(() =>
              wave.evaluate((element) => {
                const first = element.firstElementChild!.getBoundingClientRect();
                const last = element.lastElementChild!.getBoundingClientRect();
                return last.right - first.left;
              }),
            )
            .toBeGreaterThan(geometry.visibleWaveWidth);
          await page.setViewportSize({ width, height: 720 });
          await expect
            .poll(() =>
              wave.evaluate((element) => {
                const first = element.firstElementChild!.getBoundingClientRect();
                const last = element.lastElementChild!.getBoundingClientRect();
                return last.right - first.left;
              }),
            )
            .toBe(geometry.visibleWaveWidth);
        }
        const pulseBounds = await meter.evaluate((element) => {
          const indicator = element.querySelector('[data-slot="audio-input-live-indicator"]')!;
          const pulse = indicator.firstElementChild!;
          const animation = pulse.getAnimations()[0];
          if (animation === undefined) return null;
          animation.pause();
          animation.currentTime = Number(animation.effect!.getTiming().duration) * 0.5;
          const pulseRect = pulse.getBoundingClientRect();
          const recorderRect = element
            .closest('[data-slot="audio-input-recorder"]')!
            .getBoundingClientRect();
          const cancelRect = element
            .closest('[role="group"]')!
            .querySelector('[aria-label="Cancel recording"]')!
            .getBoundingClientRect();
          animation.play();
          return {
            left: pulseRect.left,
            right: pulseRect.right,
            top: pulseRect.top,
            bottom: pulseRect.bottom,
            recorderLeft: recorderRect.left,
            recorderRight: recorderRect.right,
            recorderTop: recorderRect.top,
            recorderBottom: recorderRect.bottom,
            cancelRight: cancelRect.right,
          };
        });
        if (theme === 'dark') expect(pulseBounds).not.toBeNull();
        if (pulseBounds !== null) {
          expect(pulseBounds.left).toBeGreaterThanOrEqual(pulseBounds.recorderLeft);
          expect(pulseBounds.left).toBeGreaterThan(pulseBounds.cancelRight);
          expect(pulseBounds.right).toBeLessThanOrEqual(pulseBounds.recorderRight);
          expect(pulseBounds.top).toBeGreaterThanOrEqual(pulseBounds.recorderTop);
          expect(pulseBounds.bottom).toBeLessThanOrEqual(pulseBounds.recorderBottom);
        }
        const restartGap = await row.evaluate((element) => {
          const restart = element.querySelector('[aria-label="Restart recording"]')!;
          const transcribe = element.querySelector('[aria-label="Transcribe"]')!;
          return transcribe.getBoundingClientRect().left - restart.getBoundingClientRect().right;
        });
        expect(restartGap).toBeLessThanOrEqual(8);
        if (width < 640) {
          for (const button of await row.getByRole('button').all()) {
            const bounds = await button.boundingBox();
            expect(bounds!.width).toBeGreaterThanOrEqual(44);
            expect(bounds!.height).toBeGreaterThanOrEqual(44);
          }
        }
        await section.screenshot({ path: testInfo.outputPath('recording.png') });
        await page.evaluate(() => {
          window.__jgToolbarRecorder!.dispatchEvent(
            new BlobEvent('dataavailable', {
              data: new Blob([new Uint8Array(18 * 1024 * 1024)]),
            }),
          );
        });
        const warning = row.getByRole('button', { name: 'Recording nearly full' });
        await expect(warning).toBeVisible();
        await expect(meter.locator('[data-slot="audio-input-waveform"]')).toBeVisible();
        if (width < 640) {
          await expect(warning).toContainText('!');
          const warningBounds = await warning.boundingBox();
          expect(warningBounds!.width).toBeGreaterThanOrEqual(44);
          expect(warningBounds!.height).toBeGreaterThanOrEqual(44);
          const timerBounds = await warning
            .locator('[data-slot="audio-input-warning-timer"]')
            .boundingBox();
          const waveBounds = await meter
            .locator('[data-slot="audio-input-waveform"]')
            .boundingBox();
          expect(timerBounds!.x).toBeGreaterThanOrEqual(waveBounds!.x + waveBounds!.width);
        }
        expect(await row.boundingBox()).toStrictEqual(initial);
        expect(await restart.boundingBox()).toStrictEqual(initialRestart);
        expect(await send.boundingBox()).toStrictEqual(initialSend);
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        await section.screenshot({ path: testInfo.outputPath('warning.png') });
        await warning.focus();
        await page.keyboard.press('Enter');
        const details = page.getByRole('dialog', { name: 'Recording nearly full' });
        await expect(details).toBeVisible();
        await expect(details).toContainText('Transcribe or send');
        await details.evaluate(async (element) => {
          await Promise.all(
            element.getAnimations({ subtree: true }).map((animation) => animation.finished),
          );
        });
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        await page.keyboard.press('Escape');
        await expect(warning).toBeFocused();
        await page.evaluate(() => {
          const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
          const permission = new Promise<void>((resolve) => {
            window.__jgReleaseToolbarPermission = resolve;
          });
          Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
            configurable: true,
            value: async (constraints: MediaStreamConstraints) => {
              await permission;
              return original(constraints);
            },
          });
        });
        await restart.click();
        await expect(row.getByRole('status').filter({ hasText: 'Starting' })).toBeVisible();
        expect(await row.boundingBox()).toStrictEqual(initial);
        expect(await restart.boundingBox()).toStrictEqual(initialRestart);
        expect(await send.boundingBox()).toStrictEqual(initialSend);
        await section.screenshot({ path: testInfo.outputPath('starting.png') });
        await page.evaluate(() => window.__jgReleaseToolbarPermission?.());
        await expect(row.getByRole('status').filter({ hasText: 'Recording' })).toHaveText(
          'Recording',
        );
        await expect(warning).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        await page.setViewportSize({ width, height: 440 });
        await row.getByRole('button', { name: 'Transcribe', exact: true }).scrollIntoViewIfNeeded();
        await expect(row.getByRole('button', { name: 'Transcribe', exact: true })).toBeInViewport();
        await row.getByRole('button', { name: 'Cancel recording' }).click();
        await expect(section.getByRole('button', { name: 'Record message' })).toBeFocused();
        expect(errors).toStrictEqual([]);
      } finally {
        await context.close();
      }
    });
  }
}
