import { expect, type Page } from '@playwright/test';

import type { IFakeMicrophoneOptions } from './types.js';

// the window property the init script sets once the current recording emits audio
const RECORDED_AUDIO_FLAG = '__jgPlaywrightRecordedAudio';

/**
 * Replaces, in the page, `getUserMedia` with a tone from an oscillator, and marks when the latest
 * MediaRecorder emits a chunk with bytes. Playwright runs this function in the browser, so it uses
 * nothing from outside its own body.
 * @param options The flag's name, and whether to refuse the first request.
 */
const installInPage = ({
  flag,
  rejectFirstRequest,
}: {
  flag: string;
  rejectFirstRequest: boolean;
}) => {
  const pageWindow = window as unknown as Record<string, boolean>;
  pageWindow[flag] = false;
  // a browser build without MediaRecorder, such as WebKit on Linux, can't record, but its pages can
  // still use the microphone
  if (typeof MediaRecorder !== 'undefined') {
    const originalStart = Object.getOwnPropertyDescriptor(MediaRecorder.prototype, 'start')
      ?.value as MediaRecorder['start'];
    let recording = 0;
    MediaRecorder.prototype.start = function startRecording(
      this: MediaRecorder,
      timeslice?: number,
    ) {
      recording += 1;
      const current = recording;
      pageWindow[flag] = false;
      this.addEventListener('dataavailable', (event) => {
        if (current === recording && event.data.size > 0) {
          pageWindow[flag] = true;
        }
      });
      originalStart.call(this, timeslice);
    };
  }

  let shouldReject = rejectFirstRequest;
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true,
    // a promise executor turns anything thrown into a rejection, as getUserMedia reports failures
    value: (): Promise<MediaStream> =>
      new Promise((resolve) => {
        if (shouldReject) {
          shouldReject = false;
          throw new DOMException('Permission denied', 'NotAllowedError');
        }
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const destination = context.createMediaStreamDestination();
        oscillator.connect(destination);
        oscillator.start();
        // not awaited: without an audio output device, such as Firefox on a CI runner, resume never
        // settles, and the track stays live but silent
        void context.resume();
        // stopping a track, as an app does when it's done, also stops the tone
        for (const track of destination.stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            // a second stop is a no-op, as it is on a real track
            if (track.readyState === 'ended') {
              return;
            }
            stop();
            oscillator.stop();
            void context.close();
          };
        }
        resolve(destination.stream);
      }),
  });
};

/**
 * Gives the page a fake microphone in every document it loads from now on: `getUserMedia` returns
 * a steady tone from an oscillator, while the page's own MediaRecorder still records and encodes
 * it, so a test exercises the real recording path without a device or a permission prompt. Call it
 * before `page.goto`. The tone needs an audio output device: without one, such as Firefox on a
 * Linux CI runner, the track is live but silent.
 * @param page The page.
 * @param options Whether to refuse the first request, to test the page's permission error.
 * @returns A promise that resolves once the fake is installed for later navigations.
 * @example
 * import { test } from '@playwright/test';
 * import { installFakeMicrophone, waitForRecordedAudio } from 'jg-playwright';
 *
 * test('records a voice note', async ({ page }) => {
 *   await installFakeMicrophone(page);
 *   await page.goto('/notes/new');
 *   await page.getByRole('button', { name: 'Record' }).click();
 *   await waitForRecordedAudio(page);
 *   await page.getByRole('button', { name: 'Stop' }).click();
 * });
 */
export const installFakeMicrophone = async (
  page: Page,
  { rejectFirstRequest = false }: IFakeMicrophoneOptions = {},
): Promise<void> => {
  await page.addInitScript(installInPage, { flag: RECORDED_AUDIO_FLAG, rejectFirstRequest });
};

/**
 * Waits until the page's latest MediaRecorder, started after `installFakeMicrophone`, emits a chunk
 * with bytes, so a test knows audio was captured before it stops the recording.
 * @param page The page.
 * @returns A promise that resolves once audio was recorded, or rejects with Playwright's assertion
 * error after its expect timeout.
 * @example
 * import { test } from '@playwright/test';
 * import { installFakeMicrophone, waitForRecordedAudio } from 'jg-playwright';
 *
 * test('transcribes a recording', async ({ page }) => {
 *   await installFakeMicrophone(page);
 *   await page.goto('/dictation');
 *   await page.getByRole('button', { name: 'Start dictation' }).click();
 *   await waitForRecordedAudio(page);
 * });
 */
export const waitForRecordedAudio = async (page: Page): Promise<void> => {
  await expect
    .poll(
      () =>
        page.evaluate(
          (flag) => (window as unknown as Record<string, boolean | undefined>)[flag] === true,
          RECORDED_AUDIO_FLAG,
        ),
      { message: "The page's MediaRecorder must emit a chunk of audio" },
    )
    .toBe(true);
};
