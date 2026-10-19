// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test, vi, type MockInstance } from 'vitest';

import { ERRORS } from '../shared/errors.js';

import { downloadBlob, downloadJson } from './download.js';

/**
 * Builds a page with a body that records what a download does to its link.
 * @returns The page, the link it creates, and the steps in order.
 */
const createPage = (): {
  page: { createElement: ReturnType<typeof vi.fn>; body: { append: ReturnType<typeof vi.fn> } };
  link: Record<string, unknown> & { style: { display: string } };
  steps: string[];
} => {
  const steps: string[] = [];
  const link = {
    href: '',
    download: '',
    rel: '',
    style: { display: '' },
    click: vi.fn(() => steps.push('click')),
    remove: vi.fn(() => steps.push('remove')),
  };
  const page = {
    createElement: vi.fn(() => link),
    body: { append: vi.fn(() => steps.push('append')) },
  };
  return { page, link, steps };
};

let createObjectUrl: MockInstance<typeof URL.createObjectURL>;
let revokeObjectUrl: MockInstance<typeof URL.revokeObjectURL>;

beforeEach(() => {
  vi.useFakeTimers();
  createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download');
  revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('downloadBlob', () => {
  test('clicks a hidden link to the object URL, removes it, and revokes the URL 40 seconds later', () => {
    const { page, link, steps } = createPage();
    vi.stubGlobal('document', page);
    const blob = new Blob(['id\n1\n'], { type: 'text/csv' });

    expect(downloadBlob(blob, 'users.csv')).toBe(true);

    expect(createObjectUrl).toHaveBeenCalledExactlyOnceWith(blob);
    expect(page.createElement).toHaveBeenCalledExactlyOnceWith('a');
    expect(link).toMatchObject({
      href: 'blob:download',
      download: 'users.csv',
      rel: 'noopener',
      style: { display: 'none' },
    });
    expect(steps).toStrictEqual(['append', 'click', 'remove']);
    vi.advanceTimersByTime(39_999);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('blob:download');
  });

  test('revokes the URL after revokeDelaySeconds', () => {
    vi.stubGlobal('document', createPage().page);

    downloadBlob(new Blob(['x']), 'x.txt', { revokeDelaySeconds: 2 });
    vi.advanceTimersByTime(2_000);

    expect(revokeObjectUrl).toHaveBeenCalledOnce();
  });

  test('does nothing without a document', () => {
    expect(downloadBlob(new Blob(['x']), 'x.txt')).toBe(false);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  test('does nothing without a body', () => {
    vi.stubGlobal('document', { ...createPage().page, body: null });

    expect(downloadBlob(new Blob(['x']), 'x.txt')).toBe(false);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});

describe('downloadJson', () => {
  /**
   * Gives the text of the Blob a download made.
   * @returns A promise that resolves to its text and type.
   */
  const readDownloadedBlob = async (): Promise<{ text: string; type: string }> => {
    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob;
    return { text: await blob.text(), type: blob.type };
  };

  test('saves pretty JSON ending in a newline, as application/json', async () => {
    const { page, link } = createPage();
    vi.stubGlobal('document', page);

    expect(downloadJson({ theme: 'dark', sizes: [1, 2] }, 'settings.json')).toBe(true);

    await expect(readDownloadedBlob()).resolves.toStrictEqual({
      text: '{\n  "theme": "dark",\n  "sizes": [\n    1,\n    2\n  ]\n}\n',
      type: 'application/json',
    });
    expect(link['download']).toBe('settings.json');
  });

  test('indents by the space option', async () => {
    vi.stubGlobal('document', createPage().page);

    downloadJson({ a: 1 }, 'a.json', { space: 0 });

    await expect(readDownloadedBlob()).resolves.toMatchObject({ text: '{"a":1}\n' });
  });

  test('serializes before checking for a document, and gives false without one', () => {
    expect(downloadJson([1], 'list.json')).toBe(false);
    expectToThrowCode(
      () => downloadJson({ count: 1n }, 'big.json'),
      ERRORS.UNABLE_TO_SERIALIZE_JSON,
    );
  });

  test.each([
    ['a BigInt', { count: 1n }, true],
    [
      'a cycle',
      (() => {
        const value: Record<string, unknown> = {};
        value['self'] = value;
        return value;
      })(),
      true,
    ],
    ['undefined', undefined, false],
    ['a function', () => undefined, false],
  ])('throws UNABLE_TO_SERIALIZE_JSON for %s', (_, value, hasCause) => {
    vi.stubGlobal('document', createPage().page);
    let error: unknown;

    try {
      downloadJson(value, 'value.json');
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: ERRORS.UNABLE_TO_SERIALIZE_JSON,
      message: "The value couldn't be serialized as JSON.",
    });
    expect((error as Error).cause !== undefined).toBe(hasCause);
    expect(createObjectUrl).not.toHaveBeenCalled();
  });
});
