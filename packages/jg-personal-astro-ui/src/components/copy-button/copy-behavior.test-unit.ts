import { ERRORS } from 'jg-clipboard';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  copyFromButton,
  handleCopyClick,
  readCopyText,
  registerCopyButtons,
} from './copy-behavior.ts';
import { getCopyGuidance } from './copy-guidance.ts';

/*
 * The behavior against fake elements and the real jg-clipboard, with the browser globals it reads
 * stubbed. The browser test runs the same behavior on real markup in Chromium, Firefox, and WebKit.
 */

// the parts of a copy button the fakes record: a hint for a button with a URL holds the guidance in
// its own element, above the link
type IFakeParts = {
  label: { textContent: string };
  status: { textContent: string };
  hint: {
    ownerDocument: { defaultView: null };
    textContent: string;
    hidden: boolean;
    querySelector: () => { textContent: string } | null;
  };
  hintText: { textContent: string } | null;
};

/**
 * Builds a fake copy button with its label, status, and hint, inside a code window or not.
 * @param options Its data attributes, its code window's code, the text of the elements it can
 * name, its label, and whether it has its label and wrapper.
 * @returns The button and its parts.
 */
const createButton = ({
  dataset = {},
  windowCode,
  elements = {},
  label = 'Copy',
  bare = false,
}: {
  dataset?: Record<string, string>;
  windowCode?: string | null;
  elements?: Record<string, string | null>;
  label?: string;
  bare?: boolean;
} = {}): { button: HTMLElement } & IFakeParts => {
  const hintText = dataset['copyUrl'] === undefined ? null : { textContent: '' };
  const parts: IFakeParts = {
    label: { textContent: label },
    status: { textContent: '' },
    hint: {
      ownerDocument: { defaultView: null },
      textContent: '',
      hidden: true,
      querySelector: () => hintText,
    },
    hintText,
  };
  const wrapper = {
    querySelector: (selector: string) =>
      selector === '[data-copy-status]' ? parts.status : parts.hint,
  };
  const style = {
    minWidth: '',
    removeProperty: (property: string) => {
      if (property === 'min-width') {
        style.minWidth = '';
      }
    },
  };
  const button = {
    isConnected: true,
    inert: true,
    classList: { remove: vi.fn() },
    dataset: { ...dataset },
    getBoundingClientRect: () => ({ width: 72 }),
    style,
    parentElement: bare ? null : wrapper,
    querySelector: () => (bare ? null : parts.label),
    closest: (selector: string) =>
      selector === '[data-code-window]' && windowCode !== undefined
        ? { querySelector: () => (windowCode === null ? null : { textContent: windowCode }) }
        : null,
    ownerDocument: {
      getElementById: (id: string) =>
        id in elements ? { textContent: elements[id] ?? null } : null,
    },
  };
  return { button: button as unknown as HTMLElement, ...parts };
};

/**
 * Stubs the clipboard jg-clipboard writes to, in a secure context.
 * @param writeText The clipboard's writeText.
 */
const stubClipboard = (writeText: (text: string) => Promise<void>): void => {
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
};

/**
 * Stubs fetch with one answer for every request.
 * @param answer The response's status and text, or the error the request fails with.
 * @returns The stub, which records the requests.
 */
const stubFetch = (answer: { status: number; text: string } | Error) =>
  vi.fn<(url: string) => Promise<Response>>(() =>
    answer instanceof Error
      ? Promise.reject(answer)
      : Promise.resolve(new Response(answer.text, { status: answer.status })),
  );

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('readCopyText', () => {
  test('reads the text the button carries first', () => {
    const { button } = createButton({
      dataset: { copyText: 'npm install jg-fs', copySource: 'command' },
      windowCode: 'code',
      elements: { command: 'other' },
    });

    expect(readCopyText(button)).toBe('npm install jg-fs');
  });

  test('reads the element the button names', () => {
    expect(
      readCopyText(
        createButton({ dataset: { copySource: 'command' }, elements: { command: 'pnpm add' } })
          .button,
      ),
    ).toBe('pnpm add');
    expect(
      readCopyText(createButton({ dataset: { copySource: 'missing' } }).button),
    ).toBeUndefined();
    expect(
      readCopyText(
        createButton({ dataset: { copySource: 'empty' }, elements: { empty: null } }).button,
      ),
    ).toBeUndefined();
  });

  test('reads the text at its URL, after its own text', async () => {
    const fetch = stubFetch({ status: 200, text: '# jg-fs\n' });
    vi.stubGlobal('fetch', fetch);

    expect(
      readCopyText(createButton({ dataset: { copyText: 'own', copyUrl: '/index.md' } }).button),
    ).toBe('own');
    await expect(
      readCopyText(
        createButton({ dataset: { copyUrl: '/packages/jg-fs/index.md', copySource: 'command' } })
          .button,
      ),
    ).resolves.toBe('# jg-fs\n');
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/packages/jg-fs/index.md');
  });

  test('rejects when the text at its URL fails to load', async () => {
    vi.stubGlobal('fetch', stubFetch({ status: 404, text: 'Not found' }));
    await expect(
      readCopyText(createButton({ dataset: { copyUrl: '/missing.md' } }).button),
    ).rejects.toThrow(
      "The text to copy couldn't be loaded from /missing.md: the server answered 404.",
    );

    const failure = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', stubFetch(failure));
    await expect(
      readCopyText(createButton({ dataset: { copyUrl: '/index.md' } }).button),
    ).rejects.toBe(failure);
  });

  test("reads its code window's code, or nothing outside one", () => {
    expect(readCopyText(createButton({ windowCode: 'const a = 1;' }).button)).toBe('const a = 1;');
    expect(readCopyText(createButton({ windowCode: null }).button)).toBeUndefined();
    expect(readCopyText(createButton().button)).toBeUndefined();
  });
});

describe('copyFromButton', () => {
  test('ignores a detached control before starting a clipboard write', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const { button } = createButton({ dataset: { copyText: 'x' } });
    Object.defineProperty(button, 'isConnected', { value: false });
    await copyFromButton(button);
    expect(writeText).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each([true, false])(
    'ignores a late clipboard completion after detachment (success: %s)',
    async (succeeds) => {
      const pending = Promise.withResolvers<void>();
      stubClipboard(() => pending.promise);
      const { button, label, status } = createButton({ dataset: { copyText: 'x' } });
      const completion = copyFromButton(button);
      Object.defineProperty(button, 'isConnected', { value: false });
      if (succeeds) pending.resolve();
      else pending.reject(new Error('Disk full.'));
      await completion;
      expect(button.dataset['copyState']).toBeUndefined();
      expect(label.textContent).toBe('Copy');
      expect(status.textContent).toBe('');
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  test('does not mutate a detached control when its feedback timer finishes', async () => {
    stubClipboard(() => Promise.resolve());
    const { button, label } = createButton({ dataset: { copyText: 'x' } });
    await copyFromButton(button);
    Object.defineProperty(button, 'isConnected', { value: false });
    vi.advanceTimersByTime(2_000);
    expect(label.textContent).toBe('Copied');
  });

  test('copies, shows Copied, and resets after two seconds', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const { button, label, status, hint } = createButton({ windowCode: 'const a = 1;' });

    await copyFromButton(button);

    expect(writeText).toHaveBeenCalledWith('const a = 1;');
    expect(button.dataset['copyState']).toBe('success');
    expect(label.textContent).toBe('Copied');
    expect(status.textContent).toBe('Copied to the clipboard.');
    expect(hint.hidden).toBe(true);

    vi.advanceTimersByTime(1_999);
    expect(label.textContent).toBe('Copied');
    vi.advanceTimersByTime(1);
    expect(button.dataset['copyState']).toBeUndefined();
    expect(label.textContent).toBe('Copy');
    expect(status.textContent).toBe('');
  });

  test("shows the guidance for jg-clipboard's code, naming what the button copies", async () => {
    stubClipboard(() =>
      Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
    );
    const { button, label, status, hint } = createButton({
      dataset: { copyText: 'npm install jg-fs', copyContext: 'npm install command' },
    });

    await copyFromButton(button);

    const guidance = getCopyGuidance(ERRORS.CLIPBOARD_PERMISSION_DENIED, {
      context: 'npm install command',
    });
    expect(button.dataset['copyState']).toBe('error');
    expect(label.textContent).toBe('Copy failed');
    expect(status.textContent).toBe(guidance);
    expect(hint.textContent).toBe(guidance);
    expect(hint.hidden).toBe(false);
  });

  test('copies the text at its URL, and resets to its own label', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    vi.stubGlobal('fetch', stubFetch({ status: 200, text: '# jg-fs\n\nFile system helpers.\n' }));
    const { button, label } = createButton({
      dataset: { copyUrl: '/packages/jg-fs/index.md', copyContext: 'as Markdown' },
      label: 'Copy page',
    });

    await copyFromButton(button);

    expect(writeText).toHaveBeenCalledWith('# jg-fs\n\nFile system helpers.\n');
    expect(label.textContent).toBe('Copied');
    vi.advanceTimersByTime(2_000);
    expect(label.textContent).toBe('Copy page');
  });

  test('guides to the link when the text at its URL fails to load', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    vi.stubGlobal('fetch', stubFetch({ status: 500, text: 'Server error' }));
    const { button, label, status, hint, hintText } = createButton({
      dataset: { copyUrl: '/packages/jg-fs/index.md', copyContext: 'as Markdown' },
      label: 'Copy page',
    });

    await copyFromButton(button);

    const guidance = getCopyGuidance(ERRORS.CLIPBOARD_WRITE_FAILED, {
      context: 'as Markdown',
      label: 'Copy page',
      linked: true,
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(label.textContent).toBe('Copy failed');
    expect(status.textContent).toBe(guidance);
    // the guidance goes above the link, which stays in the hint
    expect(hintText?.textContent).toBe(guidance);
    expect(hint.textContent).toBe('');
    expect(hint.hidden).toBe(false);

    await copyFromButton(button);
    expect(label.textContent).toBe('Copy failed');
  });

  test('guides a browser without the clipboard, and keeps the guidance until the next click', async () => {
    vi.stubGlobal('isSecureContext', false);
    const { button, hint } = createButton({ dataset: { copyText: 'x' } });

    await copyFromButton(button);
    vi.advanceTimersByTime(10_000);

    expect(hint.textContent).toBe(
      getCopyGuidance(ERRORS.CLIPBOARD_UNSUPPORTED, { context: 'text' }),
    );
    expect(hint.hidden).toBe(false);
  });

  test('fails with the general guidance when there is nothing to copy', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const { button, hint } = createButton();

    await copyFromButton(button);

    expect(writeText).not.toHaveBeenCalled();
    expect(hint.textContent).toBe(getCopyGuidance(null, { context: 'text' }));
  });

  test('holds its resting width while an outcome shows, and lets go when it resets', async () => {
    stubClipboard(() => Promise.resolve());
    const { button } = createButton({ dataset: { copyText: 'npm i jg-fs' } });

    await copyFromButton(button);
    expect(button.style.minWidth).toBe('72px');

    // a second outcome keeps the width the button had at rest, not the outcome's
    (
      button as unknown as { getBoundingClientRect: () => { width: number } }
    ).getBoundingClientRect = () => ({ width: 60 });
    await copyFromButton(button);
    expect(button.style.minWidth).toBe('60px');

    await vi.advanceTimersByTimeAsync(2000);
    expect(button.style.minWidth).toBe('');
  });

  test('clears the last outcome and its reset timer when clicked again', async () => {
    let fail = false;
    stubClipboard(() => (fail ? Promise.reject(new Error('Disk full.')) : Promise.resolve()));
    const { button, label, hint } = createButton({ dataset: { copyText: 'x' } });

    await copyFromButton(button);
    fail = true;
    await copyFromButton(button);
    vi.advanceTimersByTime(2_000);

    // the success's reset timer never fires over the failure
    expect(label.textContent).toBe('Copy failed');
    expect(hint.textContent).toBe(
      getCopyGuidance(ERRORS.CLIPBOARD_WRITE_FAILED, { context: 'text' }),
    );

    fail = false;
    await copyFromButton(button);
    expect(label.textContent).toBe('Copied');
    expect(hint.textContent).toBe('');
    expect(hint.hidden).toBe(true);
  });

  test('shows only the latest click, whichever copy settles last', async () => {
    const pending: { resolve: () => void; reject: (reason: unknown) => void }[] = [];
    stubClipboard(
      () =>
        new Promise<void>((resolve, reject) => {
          pending.push({ resolve, reject });
        }),
    );
    const { button, label } = createButton({ dataset: { copyText: 'x' } });

    // the first click's success, then the second's failure, settle after the third click's success
    const first = copyFromButton(button);
    const second = copyFromButton(button);
    const third = copyFromButton(button);
    pending[2]?.resolve();
    await third;
    pending[0]?.resolve();
    pending[1]?.reject(new Error('Disk full.'));
    await Promise.all([first, second]);

    expect(button.dataset['copyState']).toBe('success');
    expect(label.textContent).toBe('Copied');
  });

  test('copies from a button without a label or a wrapper', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const { button } = createButton({ dataset: { copyText: 'x' }, bare: true });

    await copyFromButton(button);

    expect(writeText).toHaveBeenCalledWith('x');
    expect(button.dataset['copyState']).toBe('success');
  });
});

describe('handleCopyClick', () => {
  test('copies when the click lands inside a copy button', () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const { button } = createButton({ dataset: { copyText: 'npm install jg-fs' } });
    const icon = {
      closest: (selector: string) => (selector === '[data-copy-button]' ? button : null),
    };

    handleCopyClick({ target: icon } as unknown as Event);

    // the clipboard call starts within the click, before anything awaits
    expect(writeText).toHaveBeenCalledWith('npm install jg-fs');
  });

  test('ignores clicks elsewhere', () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);

    handleCopyClick({ target: { closest: () => null } } as unknown as Event);
    handleCopyClick({ target: {} } as unknown as Event);
    handleCopyClick({ target: null } as unknown as Event);

    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('registerCopyButtons', () => {
  test('releases feedback timers and invalidates pending copies when the document is dismissed', async () => {
    const completed = createButton({ dataset: { copyText: 'first' } });
    const pendingButton = createButton({ dataset: { copyText: 'second' } });
    const pending = Promise.withResolvers<void>();
    stubClipboard((text) => (text === 'first' ? Promise.resolve() : pending.promise));
    const events = new Map<string, () => void>();
    class Observer {
      public observe(): void {
        /* this fixture does not mutate */
      }
      public disconnect(): void {
        /* page dismissal is observed through its effects */
      }
      public takeRecords(): MutationRecord[] {
        return [];
      }
    }
    const root = {
      contains: () => true,
      querySelectorAll: () => [completed.button, pendingButton.button],
      addEventListener: vi.fn(),
      defaultView: {
        MutationObserver: Observer,
        addEventListener: (name: string, callback: () => void) => events.set(name, callback),
      },
    } as unknown as Document;
    registerCopyButtons(root);
    await copyFromButton(completed.button);
    const completion = copyFromButton(pendingButton.button);
    expect(vi.getTimerCount()).toBe(1);
    events.get('pagehide')?.();
    expect(vi.getTimerCount()).toBe(0);
    expect(completed.label.textContent).toBe('Copy');
    expect(completed.status.textContent).toBe('');
    expect(completed.button.style.minWidth).toBe('');
    pending.resolve();
    await completion;
    expect(pendingButton.label.textContent).toBe('Copy');
    expect(pendingButton.button.dataset['copyState']).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  /**
   * Builds a fake document that records its click listeners.
   * @returns The document and its listeners.
   */
  const createDocument = (): { root: Document; listeners: unknown[] } => {
    const attributes = new Set<string>();
    const listeners: unknown[] = [];
    const root = {
      defaultView: null,
      contains: () => true,
      querySelectorAll: () => [],
      documentElement: {
        hasAttribute: (name: string) => attributes.has(name),
        setAttribute: (name: string) => attributes.add(name),
      },
      addEventListener: (type: string, listener: unknown) => {
        listeners.push([type, listener]);
      },
    };
    return { root: root as unknown as Document, listeners };
  };

  test('adds one click listener, however many components call it', () => {
    const { root, listeners } = createDocument();

    registerCopyButtons(root);
    registerCopyButtons(root);

    expect(listeners).toStrictEqual([
      ['click', handleCopyClick],
      ['astro:page-load', expect.any(Function)],
    ]);
  });

  test("registers on the page's document by default", () => {
    const { root, listeners } = createDocument();
    vi.stubGlobal('document', root);

    registerCopyButtons();

    expect(listeners).toHaveLength(2);
  });
});
