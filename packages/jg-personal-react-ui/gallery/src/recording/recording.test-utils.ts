import type { Page } from '@playwright/test';

/**
 * Uses Firefox's configured fake capture device without requiring an audio output device.
 * Keeps installFakeMicrophone's real MediaRecorder chunk observer installed.
 * @returns A promise that resolves after restoring native capture for this document.
 */
export const useFirefoxCaptureDevice = async (
  page: Page,
  browserName: string,
  rejectFirstRequest = false,
): Promise<void> => {
  if (browserName !== 'firefox') return;
  await page.evaluate((shouldRejectFirst) => {
    // remove the oscillator source; native capture uses the launch-time fake-device preference.
    Reflect.deleteProperty(navigator.mediaDevices, 'getUserMedia');
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let shouldReject = shouldRejectFirst;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async (constraints?: MediaStreamConstraints): Promise<MediaStream> => {
        if (shouldReject) {
          shouldReject = false;
          throw new DOMException('Permission denied', 'NotAllowedError');
        }
        return capture(constraints);
      },
    });
  }, rejectFirstRequest);
};
