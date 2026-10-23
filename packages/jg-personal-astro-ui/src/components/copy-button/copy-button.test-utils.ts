import type { Page } from '@playwright/test';

// the exposed binding records only the native clipboard boundary, retaining real ClipboardItem use
interface IClipboardRecorder {
  recordCopiedText: (text: string) => Promise<void>;
}

/**
 * Captures clipboard writes per page without sharing an operating-system clipboard across tests.
 * @param page The isolated browser page.
 * @returns A promise that resolves to the recorded strings, appended as writes complete.
 */
export const captureCopiedText = async (page: Page): Promise<string[]> => {
  const copied: string[] = [];
  await page.exposeFunction('recordCopiedText', (text: string) => {
    copied.push(text);
  });
  await page.addInitScript(() => {
    const capture = (text: string): Promise<void> =>
      (window as unknown as IClipboardRecorder).recordCopiedText(text);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: capture,
        write: async (items: ClipboardItem[]): Promise<void> => {
          for (const item of items) await capture(await (await item.getType('text/plain')).text());
        },
      },
    });
  });
  return copied;
};
