import { expect, test, type Page } from '@playwright/test';

import {
  startStaticServer,
  toHtmlPage,
  type IStaticServer,
} from '../shared/static-server.test-utils.js';
import { installFakeMicrophone, waitForRecordedAudio } from './microphone.js';

// the page's recording state, as its script reports it
type IRecorderWindow = Window & { recordingError?: string; recordingStopped?: boolean };

// a page that records from the microphone when a button is pressed, as an app does
const RECORDER_PAGE = toHtmlPage(`
  <button type="button">Record</button>
  <script>
    let recorder;
    document.querySelector('button').addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        recorder.addEventListener('stop', () => {
          stream.getTracks().forEach((track) => track.stop());
          window.recordingStopped = true;
        });
        recorder.start(100);
      } catch (error) {
        window.recordingError = error.name;
      }
    });
    window.stopRecording = () => recorder.stop();
  </script>
`);

let server: IStaticServer;

test.beforeAll(async () => {
  server = await startStaticServer({ '/': RECORDER_PAGE });
});

test.afterAll(async () => {
  await server.close();
});

/**
 * Reads whether the browser can run an audio context, which needs an audio output device.
 * @param page The page.
 * @returns A promise that resolves to whether a new context starts within a second.
 */
const canPlayAudio = (page: Page): Promise<boolean> =>
  page.evaluate(async () => {
    const context = new AudioContext();
    const isRunning = await Promise.race([
      context.resume().then(() => true),
      new Promise<boolean>((resolve) => {
        setTimeout(() => {
          resolve(false);
        }, 1_000);
      }),
    ]);
    void context.close();
    return isRunning;
  });

/**
 * Presses the page's record button.
 * @param page The page.
 */
const pressRecord = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Record' }).click();
};

test('gives the page a microphone whose audio the recorder captures', async ({ page }) => {
  await installFakeMicrophone(page);
  await page.goto(server.origin);
  test.skip(
    await page.evaluate(() => typeof MediaRecorder === 'undefined'),
    'This browser build has no MediaRecorder, so its pages cannot record',
  );
  test.skip(
    !(await canPlayAudio(page)),
    'This browser has no audio output device, so the tone never plays, as in Firefox on CI runners',
  );

  await pressRecord(page);
  await waitForRecordedAudio(page);
  await page.evaluate(() => (window as unknown as { stopRecording: () => void }).stopRecording());

  await expect
    .poll(() => page.evaluate(() => (window as IRecorderWindow).recordingStopped))
    .toBe(true);
  expect(await page.evaluate(() => (window as IRecorderWindow).recordingError)).toBeUndefined();
});

test('refuses the first request when asked to, then grants a live audio track', async ({
  page,
}) => {
  await installFakeMicrophone(page, { rejectFirstRequest: true });
  await page.goto(server.origin);

  const requests = await page.evaluate(async () => {
    const request = async (): Promise<string> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return stream
          .getTracks()
          .map((track) => `${track.kind}:${track.readyState}`)
          .join(',');
      } catch (error) {
        return (error as DOMException).name;
      }
    };
    return [await request(), await request()];
  });

  expect(requests).toStrictEqual(['NotAllowedError', 'audio:live']);
});

test('grants the first request by default, with a track that stops once', async ({ page }) => {
  await installFakeMicrophone(page);
  await page.goto(server.origin);

  const states = await page.evaluate(async () => {
    const [track] = (await navigator.mediaDevices.getUserMedia({ audio: true })).getAudioTracks();
    const before = track?.readyState;
    track?.stop();
    track?.stop();
    return [before, track?.readyState];
  });

  expect(states).toStrictEqual(['live', 'ended']);
});
