import { describe, expect, test, vi } from 'vitest';

import { installFakeBrowser } from '../shared/browser.test-utils.js';
import { getClipboardSupport } from './support.js';

describe('getClipboardSupport', () => {
  test('reports every feature in a secure page with a full clipboard', () => {
    installFakeBrowser();

    expect(getClipboardSupport()).toStrictEqual({
      isSecureContext: true,
      copyText: true,
      copyHtml: true,
      copyImage: true,
      readText: true,
      read: true,
    });
  });

  test('reports nothing during server rendering, where the browser globals are missing', () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('isSecureContext', undefined);
    vi.stubGlobal('ClipboardItem', undefined);

    expect(getClipboardSupport()).toStrictEqual({
      isSecureContext: false,
      copyText: false,
      copyHtml: false,
      copyImage: false,
      readText: false,
      read: false,
    });
  });

  test('reports nothing in an insecure page, even with a clipboard', () => {
    installFakeBrowser({ isSecureContext: false });

    expect(Object.values(getClipboardSupport()).some(Boolean)).toBe(false);
  });

  test('can copy text with writeText alone, but not HTML or images, without ClipboardItem', () => {
    installFakeBrowser({ clipboardItem: false, methods: ['writeText', 'readText'] });

    expect(getClipboardSupport()).toMatchObject({
      copyText: true,
      copyHtml: false,
      copyImage: false,
      readText: true,
      read: false,
    });
  });

  test('can copy text through ClipboardItem without writeText', () => {
    installFakeBrowser({ methods: ['write'] });

    expect(getClipboardSupport()).toMatchObject({ copyText: true, readText: false });
  });

  test('follows ClipboardItem.supports where the browser has it', () => {
    installFakeBrowser({ clipboardItem: ['text/plain', 'text/html'], methods: ['write'] });

    expect(getClipboardSupport()).toMatchObject({
      copyText: true,
      copyHtml: true,
      copyImage: false,
    });
  });

  test('counts the types every browser must accept when ClipboardItem.supports is missing', () => {
    installFakeBrowser({ clipboardItem: 'no-supports' });

    expect(getClipboardSupport()).toMatchObject({ copyHtml: true, copyImage: true });
  });

  test('reports nothing, instead of throwing, when reading a feature throws', () => {
    installFakeBrowser();
    vi.stubGlobal('navigator', {
      get clipboard(): never {
        throw new Error('blocked frame');
      },
    });

    expect(getClipboardSupport().copyText).toBe(false);
  });
});
