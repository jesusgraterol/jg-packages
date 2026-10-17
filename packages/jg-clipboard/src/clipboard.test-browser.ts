import { describe, expect, test } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';

import {
  copyHtml,
  copyImage,
  copyText,
  ERRORS,
  getClipboardSupport,
  readClipboard,
  readText,
} from './index.js';

/*
 * The clipboard in real browsers. Every engine lets a click copy, but headless Firefox and WebKit
 * show paste prompts that can't be automated, so only Chromium, with its clipboard permissions
 * granted, reads back what was copied. The unit tests cover the reads elsewhere.
 */

const IS_CHROMIUM = server.browser === 'chromium';

/**
 * Draws a small image and exports it in a type.
 * @param type The image type, such as image/jpeg.
 * @returns A promise that resolves to the image.
 */
const drawImage = (type: string): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = 3;
  canvas.height = 2;
  const context = canvas.getContext('2d');
  if (context !== null) {
    context.fillStyle = '#0f766e';
    context.fillRect(0, 0, 3, 2);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error(`The canvas produced no ${type}.`));
      } else {
        resolve(blob);
      }
    }, type);
  });
};

/**
 * Runs an operation from a real click, as a page's button does, so the browser sees the gesture.
 * The outcome is captured as soon as the operation settles, because it can settle while the click
 * is still being reported, and a rejection must never go unhandled meanwhile.
 * @param operation The operation, started by the click handler.
 * @returns A promise that settles like the operation.
 */
const runOnClick = async <T>(operation: () => Promise<T>): Promise<T> => {
  const button = document.createElement('button');
  button.textContent = 'Copy';
  document.body.append(button);
  let outcome: Promise<{ value: T } | { error: unknown }> | undefined;
  button.addEventListener('click', () => {
    outcome = operation().then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
  });
  try {
    await userEvent.click(button);
  } finally {
    button.remove();
  }
  if (outcome === undefined) {
    throw new Error('The click handler never ran.');
  }
  const settled = await outcome;
  if ('error' in settled) {
    throw settled.error;
  }
  return settled.value;
};

/**
 * Gives the page Chromium's clipboard permissions, or takes them away, in the browser context
 * Playwright opened the page in.
 * @param granted Whether to grant them.
 * @returns A promise that resolves once Chromium applied the change.
 */
const setChromiumClipboardPermissions = async (granted: boolean): Promise<void> => {
  const session = cdp();
  const { targetInfo } = (await session.send('Target.getTargetInfo')) as {
    targetInfo: { browserContextId: string };
  };
  const { browserContextId } = targetInfo;
  await (granted
    ? session.send('Browser.grantPermissions', {
        permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
        origin: location.origin,
        browserContextId,
      })
    : session.send('Browser.resetPermissions', { browserContextId }));
};

describe('getClipboardSupport', () => {
  test('reports every feature on a localhost page', () => {
    expect(getClipboardSupport()).toStrictEqual({
      isSecureContext: true,
      copyText: true,
      copyHtml: true,
      copyImage: true,
      readText: true,
      read: true,
    });
  });
});

describe.skipIf(IS_CHROMIUM)('copying from a click in Firefox and WebKit', () => {
  test.each([
    ['text', () => copyText('npm install jg-clipboard')],
    [
      'text that loads after the click',
      () =>
        copyText(
          new Promise<string>((resolve) => {
            setTimeout(() => resolve('loaded later'), 50);
          }),
        ),
    ],
    ['HTML', () => copyHtml('<b>Order #42</b> shipped')],
    ['a PNG', async () => copyImage(await drawImage('image/png'))],
    ['a JPEG, redrawn as PNG', () => copyImage(drawImage('image/jpeg'))],
  ])('copies %s', async (_, copy) => {
    await expect(runOnClick(copy)).resolves.toBeUndefined();
  });
});

describe.runIf(IS_CHROMIUM)('copying and reading in Chromium', () => {
  test('refuses a copy without the clipboard permission, naming the reason', async () => {
    await setChromiumClipboardPermissions(false);

    await expect(runOnClick(() => copyText('hello'))).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_PERMISSION_DENIED,
      cause: { name: 'NotAllowedError' },
    });
  });

  test('reads back the text it copied', async () => {
    await setChromiumClipboardPermissions(true);

    await runOnClick(() => copyText('npm install jg-clipboard'));
    await expect(runOnClick(() => readText())).resolves.toBe('npm install jg-clipboard');

    await runOnClick(() => copyText(Promise.resolve('loaded later')));
    await expect(runOnClick(() => readText())).resolves.toBe('loaded later');
  });

  test('reads back HTML with its plain text', async () => {
    await setChromiumClipboardPermissions(true);

    await runOnClick(() => copyHtml('<b>Order #42</b> shipped'));
    const content = await runOnClick(() => readClipboard());

    expect(content.html).toContain('<b>Order #42</b> shipped');
    expect(content.text).toBe('Order #42 shipped');
  });

  test('reads back a JPEG it copied as a PNG of the same size', async () => {
    await setChromiumClipboardPermissions(true);

    await runOnClick(() => copyImage(drawImage('image/jpeg')));
    const { image } = await runOnClick(() => readClipboard());

    expect(image?.type).toBe('image/png');
    const bitmap = await createImageBitmap(image as Blob);
    expect([bitmap.width, bitmap.height]).toStrictEqual([3, 2]);
    bitmap.close();
  });
});
