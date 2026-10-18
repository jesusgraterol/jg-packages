import { describe, expect, test, vi } from 'vitest';

import { domError, FakeClipboardItem, installFakeBrowser } from '../shared/browser.test-utils.js';
import { ERRORS } from '../shared/index.js';
import { readClipboard, readText } from './read.js';

describe('readText', () => {
  test("returns the clipboard's text, or an empty string", async () => {
    const { clipboard } = installFakeBrowser();
    clipboard.readText.mockResolvedValueOnce('copied').mockResolvedValueOnce('');

    await expect(readText()).resolves.toBe('copied');
    await expect(readText()).resolves.toBe('');
  });

  test('names the browser refusing the read', async () => {
    const { clipboard } = installFakeBrowser({ hasFocus: false });
    clipboard.readText.mockRejectedValue(domError('NotAllowedError'));

    await expect(readText()).rejects.toMatchObject({ code: ERRORS.CLIPBOARD_NOT_FOCUSED });
  });

  test('reports any other failure as CLIPBOARD_READ_FAILED', async () => {
    const { clipboard } = installFakeBrowser();
    const cause = domError('UnknownError');
    clipboard.readText.mockRejectedValue(cause);

    await expect(readText()).rejects.toMatchObject({ code: ERRORS.CLIPBOARD_READ_FAILED, cause });
  });

  test.each([
    ['an insecure page', { isSecureContext: false }],
    ['a browser without readText', { methods: ['write', 'writeText', 'read'] }],
  ] as const)('throws CLIPBOARD_UNSUPPORTED in %s', async (_, options) => {
    installFakeBrowser(options);

    await expect(readText()).rejects.toMatchObject({ code: ERRORS.CLIPBOARD_UNSUPPORTED });
  });
});

describe('readClipboard', () => {
  test('reads text, HTML, and the PNG image with one read call', async () => {
    const { clipboard } = installFakeBrowser();
    const png = new Blob(['png'], { type: 'image/png' });
    clipboard.read.mockResolvedValue([
      new FakeClipboardItem({ 'text/plain': 'Order #42', 'text/html': '<b>Order #42</b>' }),
      new FakeClipboardItem({
        'image/jpeg': new Blob(['jpeg'], { type: 'image/jpeg' }),
        'image/png': png,
      }),
    ]);

    await expect(readClipboard()).resolves.toStrictEqual({
      text: 'Order #42',
      html: '<b>Order #42</b>',
      image: png,
    });
    expect(clipboard.read).toHaveBeenCalledOnce();
  });

  test('returns null for each kind of content the clipboard lacks', async () => {
    const { clipboard } = installFakeBrowser();
    clipboard.read
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([new FakeClipboardItem({ 'text/plain': 'only text' })]);

    await expect(readClipboard()).resolves.toStrictEqual({ text: null, html: null, image: null });
    await expect(readClipboard()).resolves.toStrictEqual({
      text: 'only text',
      html: null,
      image: null,
    });
  });

  test('converts an image of another type to PNG', async () => {
    const { clipboard } = installFakeBrowser();
    const png = new Blob(['png'], { type: 'image/png' });
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 1, height: 1, close() {} }));
    vi.stubGlobal('OffscreenCanvas', function (this: object) {
      Object.assign(this, {
        getContext: () => ({ drawImage() {} }),
        convertToBlob: () => Promise.resolve(png),
      });
    });
    clipboard.read.mockResolvedValue([
      new FakeClipboardItem({ 'image/tiff': new Blob(['tiff'], { type: 'image/tiff' }) }),
    ]);

    await expect(readClipboard()).resolves.toMatchObject({ image: png });
  });

  test('throws CLIPBOARD_INVALID_IMAGE for an image it cannot convert', async () => {
    const { clipboard } = installFakeBrowser();
    vi.stubGlobal('createImageBitmap', () => Promise.reject(domError('InvalidStateError')));
    clipboard.read.mockResolvedValue([
      new FakeClipboardItem({ 'image/svg+xml': new Blob(['<svg/>'], { type: 'image/svg+xml' }) }),
    ]);

    await expect(readClipboard()).rejects.toMatchObject({ code: ERRORS.CLIPBOARD_INVALID_IMAGE });
  });

  test('keeps the text and HTML copied with an image it cannot convert or load', async () => {
    const { clipboard } = installFakeBrowser();
    vi.stubGlobal('createImageBitmap', () => Promise.reject(domError('InvalidStateError')));
    clipboard.read
      .mockResolvedValueOnce([
        new FakeClipboardItem({
          'text/plain': 'A1\tB1',
          'text/html': '<table><tr><td>A1</td><td>B1</td></tr></table>',
          'image/tiff': new Blob(['tiff'], { type: 'image/tiff' }),
        }),
      ])
      .mockResolvedValueOnce([
        new FakeClipboardItem({ 'text/html': '<b>x</b>' }),
        Object.assign(new FakeClipboardItem({ 'image/png': new Blob(['png']) }), {
          getType: () => Promise.reject(domError('NotFoundError')),
        }),
      ]);

    await expect(readClipboard()).resolves.toStrictEqual({
      text: 'A1\tB1',
      html: '<table><tr><td>A1</td><td>B1</td></tr></table>',
      image: null,
    });
    await expect(readClipboard()).resolves.toStrictEqual({
      text: null,
      html: '<b>x</b>',
      image: null,
    });
  });

  test('throws for an image it cannot read when nothing else was copied with it', async () => {
    const { clipboard } = installFakeBrowser();
    const cause = domError('NotFoundError');
    vi.stubGlobal('createImageBitmap', () => Promise.reject(domError('InvalidStateError')));
    clipboard.read
      .mockResolvedValueOnce([
        new FakeClipboardItem({
          'text/plain': '',
          'image/gif': new Blob(['gif'], { type: 'image/gif' }),
        }),
      ])
      .mockResolvedValueOnce([
        Object.assign(new FakeClipboardItem({ 'image/png': new Blob(['png']) }), {
          getType: () => Promise.reject(cause),
        }),
      ]);

    // empty text counts as nothing to paste
    await expect(readClipboard()).rejects.toMatchObject({ code: ERRORS.CLIPBOARD_INVALID_IMAGE });
    await expect(readClipboard()).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_READ_FAILED,
      cause,
    });
  });

  test('reports an item that fails to give its content as CLIPBOARD_READ_FAILED', async () => {
    const { clipboard } = installFakeBrowser();
    const cause = domError('NotFoundError');
    clipboard.read.mockResolvedValue([
      Object.assign(new FakeClipboardItem({ 'text/plain': 'x' }), {
        getType: () => Promise.reject(cause),
      }),
    ]);

    await expect(readClipboard()).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_READ_FAILED,
      message: "The clipboard's content couldn't be read.",
      cause,
    });
  });

  test('names the browser refusing the read', async () => {
    const { clipboard } = installFakeBrowser({ permission: 'denied' });
    clipboard.read.mockRejectedValue(domError('NotAllowedError'));

    await expect(readClipboard()).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_PERMISSION_DENIED,
      data: { permission: 'denied' },
    });
  });

  test('throws CLIPBOARD_UNSUPPORTED without read', async () => {
    installFakeBrowser({ methods: ['readText'] });

    await expect(readClipboard()).rejects.toMatchObject({ code: ERRORS.CLIPBOARD_UNSUPPORTED });
  });
});
