import { describe, expect, test, vi } from 'vitest';

import {
  domError,
  type FakeClipboardItem,
  installFakeBrowser,
} from '../shared/browser.test-utils.js';
import { ERRORS } from '../shared/index.js';
import { copyHtml, copyImage, copyText } from './copy.js';

// the item the fake clipboard's write received
const writtenItem = (write: { mock: { calls: FakeClipboardItem[][][] } }): FakeClipboardItem => {
  const item = write.mock.calls.at(-1)?.[0]?.[0];
  if (item === undefined) {
    throw new Error('expected a written ClipboardItem');
  }
  return item;
};

// the text of one type in a written item
const writtenText = async (item: FakeClipboardItem, type: string): Promise<string> =>
  (await item.getType(type)).text();

// a promise and the functions that settle it, for content that loads after the click
const deferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// stubs image decoding and an OffscreenCanvas whose PNG is `png`
const installImageDecoding = (png = new Blob(['png'], { type: 'image/png' })) => {
  const bitmap = { width: 3, height: 2, close: vi.fn() };
  const createImageBitmap = vi.fn(() => Promise.resolve(bitmap));
  const drawImage = vi.fn();
  const convertToBlob = vi.fn(() => Promise.resolve(png));
  const OffscreenCanvas = vi.fn(function (this: object, width: number, height: number) {
    Object.assign(this, { width, height, getContext: () => ({ drawImage }), convertToBlob });
  });
  vi.stubGlobal('createImageBitmap', createImageBitmap);
  vi.stubGlobal('OffscreenCanvas', OffscreenCanvas);
  return { bitmap, createImageBitmap, drawImage, convertToBlob, OffscreenCanvas, png };
};

describe('copyText', () => {
  test('writes a string with writeText, called before the first await', async () => {
    const { clipboard } = installFakeBrowser();

    const copying = copyText('npm install jg-clipboard');

    expect(clipboard.writeText).toHaveBeenCalledWith('npm install jg-clipboard');
    await expect(copying).resolves.toBeUndefined();
    expect(clipboard.write).not.toHaveBeenCalled();
  });

  test('writes a promise through a ClipboardItem that waits for it, called before the first await', async () => {
    const { clipboard } = installFakeBrowser();
    const text = deferred<string>();

    const copying = copyText(text.promise);

    expect(clipboard.write).toHaveBeenCalledOnce();
    text.resolve('https://example.com/share/1');
    await copying;
    const item = writtenItem(clipboard.write);
    expect(item.types).toStrictEqual(['text/plain']);
    await expect(writtenText(item, 'text/plain')).resolves.toBe('https://example.com/share/1');
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  test('writes a string through a ClipboardItem when the browser has no writeText', async () => {
    const { clipboard } = installFakeBrowser({ methods: ['write'] });

    await copyText('hello');

    await expect(writtenText(writtenItem(clipboard.write), 'text/plain')).resolves.toBe('hello');
  });

  test('waits for a promise, then calls writeText, without ClipboardItem', async () => {
    const { clipboard } = installFakeBrowser({ clipboardItem: false });
    const text = deferred<string>();

    const copying = copyText(text.promise);
    expect(clipboard.writeText).not.toHaveBeenCalled();
    text.resolve('later');
    await copying;

    expect(clipboard.writeText).toHaveBeenCalledWith('later');
  });

  test.each([
    ['through a ClipboardItem', {}],
    ['without ClipboardItem', { clipboardItem: false }],
  ] as const)(
    'reports text that fails to load %s as CLIPBOARD_WRITE_FAILED, with its error as the cause',
    async (_, options) => {
      const { clipboard } = installFakeBrowser(options);
      const cause = new Error('the request failed');
      clipboard.write.mockImplementation(async ([item]) => {
        await item?.getType('text/plain');
      });

      await expect(copyText(Promise.reject(cause))).rejects.toMatchObject({
        code: ERRORS.CLIPBOARD_WRITE_FAILED,
        message: "The content to copy couldn't be loaded.",
        cause,
      });
    },
  );

  test('names the browser refusing the write', async () => {
    const { clipboard } = installFakeBrowser({ userActivation: false });
    clipboard.writeText.mockRejectedValue(domError('NotAllowedError'));

    await expect(copyText('hello')).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_NO_USER_GESTURE,
    });
  });

  test.each([
    ['an insecure page', { isSecureContext: false }],
    ['a browser without a way to write', { methods: ['read', 'readText'] }],
  ] as const)('throws CLIPBOARD_UNSUPPORTED in %s', async (_, options) => {
    installFakeBrowser(options);

    await expect(copyText('hello')).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_UNSUPPORTED,
    });
  });
});

describe('copyHtml', () => {
  test('writes the HTML and the given text in one item, called before the first await', async () => {
    const { clipboard } = installFakeBrowser();

    const copying = copyHtml('<b>Order #42</b> shipped', { text: 'Order 42 shipped' });

    expect(clipboard.write).toHaveBeenCalledOnce();
    await copying;
    const item = writtenItem(clipboard.write);
    expect(item.types).toStrictEqual(['text/html', 'text/plain']);
    await expect(writtenText(item, 'text/html')).resolves.toBe('<b>Order #42</b> shipped');
    await expect(writtenText(item, 'text/plain')).resolves.toBe('Order 42 shipped');
  });

  test("falls back to the HTML's text content for the plain text", async () => {
    const { clipboard } = installFakeBrowser();
    const parseFromString = vi.fn((html: string) => ({
      body: { textContent: html.replace(/<[^>]+>/g, '') },
    }));
    vi.stubGlobal(
      'DOMParser',
      vi.fn(function (this: object) {
        Object.assign(this, { parseFromString });
      }),
    );

    await copyHtml('<b>Order #42</b> shipped');

    await expect(writtenText(writtenItem(clipboard.write), 'text/plain')).resolves.toBe(
      'Order #42 shipped',
    );
    expect(parseFromString).toHaveBeenCalledWith('<b>Order #42</b> shipped', 'text/html');
  });

  test('derives the plain text once promised HTML loads, and accepts promised text', async () => {
    const { clipboard } = installFakeBrowser();
    vi.stubGlobal(
      'DOMParser',
      vi.fn(function (this: object) {
        Object.assign(this, { parseFromString: () => ({ body: { textContent: 'from html' } }) });
      }),
    );
    const html = deferred<string>();

    const copying = copyHtml(html.promise);
    expect(clipboard.write).toHaveBeenCalledOnce();
    html.resolve('<p>from html</p>');
    await copying;
    await expect(writtenText(writtenItem(clipboard.write), 'text/plain')).resolves.toBe(
      'from html',
    );

    await copyHtml('<p>x</p>', { text: Promise.resolve('promised text') });
    await expect(writtenText(writtenItem(clipboard.write), 'text/plain')).resolves.toBe(
      'promised text',
    );
  });

  test('uses an empty plain text where there is no DOMParser or no text content', async () => {
    const { clipboard } = installFakeBrowser();
    vi.stubGlobal('DOMParser', undefined);

    await copyHtml('<p>x</p>');
    await expect(writtenText(writtenItem(clipboard.write), 'text/plain')).resolves.toBe('');

    vi.stubGlobal(
      'DOMParser',
      vi.fn(function (this: object) {
        Object.assign(this, { parseFromString: () => ({ body: { textContent: null } }) });
      }),
    );
    await copyHtml('<img alt="">');
    await expect(writtenText(writtenItem(clipboard.write), 'text/plain')).resolves.toBe('');
  });

  test.each([
    ['without ClipboardItem', { clipboardItem: false }],
    ['when ClipboardItem refuses text/html', { clipboardItem: ['text/plain'] }],
    ['without write', { methods: ['writeText'] }],
  ] as const)('throws CLIPBOARD_UNSUPPORTED %s', async (_, options) => {
    installFakeBrowser(options);

    await expect(copyHtml('<p>x</p>', { text: 'x' })).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_UNSUPPORTED,
    });
  });
});

describe('copyImage', () => {
  test('writes a PNG as it is, called before the first await', async () => {
    const { clipboard } = installFakeBrowser();
    const { createImageBitmap } = installImageDecoding();
    const png = new Blob(['png bytes'], { type: 'image/png' });

    const copying = copyImage(png);

    expect(clipboard.write).toHaveBeenCalledOnce();
    await copying;
    expect(writtenItem(clipboard.write).items['image/png']).toBe(png);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  test('redraws another type as PNG on an OffscreenCanvas', async () => {
    const { clipboard } = installFakeBrowser();
    const decoding = installImageDecoding();
    const jpeg = new Blob(['jpeg bytes'], { type: 'image/jpeg' });

    const copying = copyImage(jpeg);
    expect(clipboard.write).toHaveBeenCalledOnce();
    await copying;

    await expect(writtenItem(clipboard.write).getType('image/png')).resolves.toBe(decoding.png);
    expect(decoding.createImageBitmap).toHaveBeenCalledWith(jpeg);
    expect(decoding.OffscreenCanvas).toHaveBeenCalledWith(3, 2);
    expect(decoding.drawImage).toHaveBeenCalledWith(decoding.bitmap, 0, 0);
    expect(decoding.convertToBlob).toHaveBeenCalledWith({ type: 'image/png' });
    expect(decoding.bitmap.close).toHaveBeenCalledOnce();
  });

  test('waits for a promised image, and keeps a promised PNG as it is', async () => {
    const { clipboard } = installFakeBrowser();
    const { createImageBitmap } = installImageDecoding();
    const png = new Blob(['png bytes'], { type: 'image/png' });
    const image = deferred<Blob>();

    const copying = copyImage(image.promise);
    expect(clipboard.write).toHaveBeenCalledOnce();
    image.resolve(png);
    await copying;

    await expect(writtenItem(clipboard.write).getType('image/png')).resolves.toBe(png);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  test('draws on a page canvas where there is no OffscreenCanvas', async () => {
    const { clipboard } = installFakeBrowser();
    const { png } = installImageDecoding();
    vi.stubGlobal('OffscreenCanvas', undefined);
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (callback: (blob: Blob | null) => void, type: string) => {
        callback(type === 'image/png' ? png : null);
      },
    };
    vi.stubGlobal('document', { hasFocus: () => true, createElement: () => canvas });

    await copyImage(new Blob(['webp'], { type: 'image/webp' }));

    await expect(writtenItem(clipboard.write).getType('image/png')).resolves.toBe(png);
    expect(canvas).toMatchObject({ width: 3, height: 2 });
  });

  test('throws CLIPBOARD_INVALID_IMAGE when the page canvas produces no PNG', async () => {
    const { clipboard } = installFakeBrowser();
    installImageDecoding();
    vi.stubGlobal('OffscreenCanvas', undefined);
    vi.stubGlobal('document', {
      hasFocus: () => true,
      createElement: () => ({
        getContext: () => null,
        toBlob: (callback: (blob: Blob | null) => void) => {
          callback(null);
        },
      }),
    });
    clipboard.write.mockImplementation(async ([item]) => {
      await item?.getType('image/png');
    });

    await expect(copyImage(new Blob(['webp'], { type: 'image/webp' }))).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_INVALID_IMAGE,
      cause: new Error('The canvas produced no PNG.'),
    });
  });

  test.each([
    [
      'an image the browser fails to decode',
      () => {
        installImageDecoding().createImageBitmap.mockRejectedValue(domError('InvalidStateError'));
      },
      new Blob(['not an image'], { type: 'text/plain' }),
    ],
    [
      'a browser without createImageBitmap',
      () => vi.stubGlobal('createImageBitmap', undefined),
      new Blob(['gif'], { type: 'image/gif' }),
    ],
    ['a value that is not a Blob', () => installImageDecoding(), 'not a blob' as unknown as Blob],
  ])('throws CLIPBOARD_INVALID_IMAGE for %s', async (_, setUp, image) => {
    const { clipboard } = installFakeBrowser();
    setUp();
    // the browser rejects the write when its content fails, with its own error
    clipboard.write.mockImplementation(async ([item]) => {
      try {
        await item?.getType('image/png');
      } catch {
        throw domError('NotAllowedError');
      }
    });

    await expect(copyImage(Promise.resolve(image))).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_INVALID_IMAGE,
      message: "The image couldn't be decoded, so it can't be copied as PNG.",
    });
  });

  test('throws CLIPBOARD_INVALID_IMAGE, with the drawing error, when the canvas fails', async () => {
    const { clipboard } = installFakeBrowser();
    const decoding = installImageDecoding();
    const cause = domError('SecurityError');
    decoding.convertToBlob.mockRejectedValue(cause);
    clipboard.write.mockImplementation(async ([item]) => {
      await item?.getType('image/png');
    });

    await expect(copyImage(new Blob(['jpeg'], { type: 'image/jpeg' }))).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_INVALID_IMAGE,
      cause,
    });
    expect(decoding.bitmap.close).toHaveBeenCalledOnce();
  });

  test("names the browser's refusal at once, without waiting for content still loading", async () => {
    const { clipboard } = installFakeBrowser({ userActivation: false });
    clipboard.write.mockRejectedValue(domError('NotAllowedError'));
    const neverLoads = new Promise<Blob>(() => undefined);

    await expect(copyImage(neverLoads)).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_NO_USER_GESTURE,
    });
  });

  test('keeps content that fails after the browser refused handled', async () => {
    const { clipboard } = installFakeBrowser({ userActivation: false });
    clipboard.write.mockRejectedValue(domError('NotAllowedError'));
    const image = deferred<Blob>();

    await expect(copyImage(image.promise)).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_NO_USER_GESTURE,
    });
    // an unhandled rejection here fails the run
    image.reject(new Error('the request failed later'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  test('names the browser refusing the write when the content loaded', async () => {
    const { clipboard } = installFakeBrowser({ permission: 'denied' });
    clipboard.write.mockRejectedValue(domError('NotAllowedError'));

    await expect(copyImage(new Blob(['png'], { type: 'image/png' }))).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_PERMISSION_DENIED,
    });
  });

  test.each([
    ['without ClipboardItem', { clipboardItem: false }],
    ['when ClipboardItem refuses image/png', { clipboardItem: ['text/plain', 'text/html'] }],
  ] as const)('throws CLIPBOARD_UNSUPPORTED %s', async (_, options) => {
    installFakeBrowser(options);

    await expect(copyImage(new Blob(['png'], { type: 'image/png' }))).rejects.toMatchObject({
      code: ERRORS.CLIPBOARD_UNSUPPORTED,
    });
  });
});
