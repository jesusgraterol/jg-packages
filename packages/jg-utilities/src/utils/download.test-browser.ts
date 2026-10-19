import { afterEach, describe, expect, test, vi } from 'vitest';

import { downloadBlob, downloadJson } from './download.js';

// the parts of a link the test reads
type ILinkState = { href: string; download: string; rel: string; style: { display: string } };

/*
 * The browser globals the test uses. The package also typechecks without the DOM, so they're
 * read from globalThis with the parts the test needs.
 */
const browser = globalThis as unknown as {
  document: { querySelector: (selector: string) => ILinkState | null };
  HTMLAnchorElement: { prototype: { click: () => void } };
};

/**
 * Stops links from downloading, and records each clicked link as the page held it then.
 * @returns The links, in the order they were clicked.
 */
const recordClicks = (): ILinkState[] => {
  const clicked: ILinkState[] = [];
  vi.spyOn(browser.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
    const link = browser.document.querySelector('a[download]');
    if (link !== null) {
      clicked.push({
        href: link.href,
        download: link.download,
        rel: link.rel,
        style: { display: link.style.display },
      });
    }
  });
  return clicked;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('downloads in a browser', () => {
  test('save JSON as a file ending in a newline', async () => {
    const clicked = recordClicks();

    expect(downloadJson({ theme: 'dark' }, 'settings.json')).toBe(true);

    expect(clicked[0]?.download).toBe('settings.json');
    await expect((await fetch(clicked[0]?.href ?? '')).text()).resolves.toBe(
      '{\n  "theme": "dark"\n}\n',
    );
  });

  test('click a hidden link in the page to the object URL, then remove it', async () => {
    const clicked = recordClicks();

    expect(downloadBlob(new Blob(['id\n1\n'], { type: 'text/csv' }), 'users.csv')).toBe(true);

    expect(clicked).toHaveLength(1);
    expect(clicked[0]).toMatchObject({
      download: 'users.csv',
      rel: 'noopener',
      style: { display: 'none' },
    });
    expect(clicked[0]?.href).toMatch(/^blob:/);
    expect(browser.document.querySelector('a[download]')).toBeNull();
    // the file can still be read after the click
    await expect((await fetch(clicked[0]?.href ?? '')).text()).resolves.toBe('id\n1\n');
  });

  test('revoke the object URL only after the delay', async () => {
    const clicked = recordClicks();
    const revoke = vi.spyOn(URL, 'revokeObjectURL');

    downloadBlob(new Blob(['notes']), 'notes.txt', { revokeDelaySeconds: 0.2 });
    const href = clicked[0]?.href ?? '';

    expect(revoke).not.toHaveBeenCalled();
    await expect((await fetch(href)).text()).resolves.toBe('notes');
    await vi.waitFor(() => {
      expect(revoke).toHaveBeenCalledExactlyOnceWith(href);
    });
  });
});
