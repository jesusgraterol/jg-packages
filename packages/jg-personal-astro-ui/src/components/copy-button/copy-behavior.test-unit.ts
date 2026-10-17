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

// the parts of a copy button the fakes record
type IFakeParts = {
  label: { textContent: string };
  status: { textContent: string };
  hint: { textContent: string; hidden: boolean };
};

/**
 * Builds a fake copy button with its label, status, and hint, inside a code window or not.
 * @param options Its data attributes, its code window's code, the text of the elements it can
 * name, and whether it has its label and wrapper.
 * @returns The button and its parts.
 */
const createButton = ({
  dataset = {},
  windowCode,
  elements = {},
  bare = false,
}: {
  dataset?: Record<string, string>;
  windowCode?: string | null;
  elements?: Record<string, string | null>;
  bare?: boolean;
} = {}): { button: HTMLElement } & IFakeParts => {
  const parts: IFakeParts = {
    label: { textContent: 'Copy' },
    status: { textContent: '' },
    hint: { textContent: '', hidden: true },
  };
  const wrapper = {
    querySelector: (selector: string) =>
      selector === '[data-copy-status]' ? parts.status : parts.hint,
  };
  const button = {
    dataset: { ...dataset },
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

  test("reads its code window's code, or nothing outside one", () => {
    expect(readCopyText(createButton({ windowCode: 'const a = 1;' }).button)).toBe('const a = 1;');
    expect(readCopyText(createButton({ windowCode: null }).button)).toBeUndefined();
    expect(readCopyText(createButton().button)).toBeUndefined();
  });
});

describe('copyFromButton', () => {
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

    const guidance = getCopyGuidance(ERRORS.CLIPBOARD_PERMISSION_DENIED, 'npm install command');
    expect(button.dataset['copyState']).toBe('error');
    expect(label.textContent).toBe('Copy failed');
    expect(status.textContent).toBe(guidance);
    expect(hint).toStrictEqual({ textContent: guidance, hidden: false });
  });

  test('guides a browser without the clipboard, and keeps the guidance until the next click', async () => {
    vi.stubGlobal('isSecureContext', false);
    const { button, hint } = createButton({ dataset: { copyText: 'x' } });

    await copyFromButton(button);
    vi.advanceTimersByTime(10_000);

    expect(hint.textContent).toBe(getCopyGuidance(ERRORS.CLIPBOARD_UNSUPPORTED, 'text'));
    expect(hint.hidden).toBe(false);
  });

  test('fails with the general guidance when there is nothing to copy', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const { button, hint } = createButton();

    await copyFromButton(button);

    expect(writeText).not.toHaveBeenCalled();
    expect(hint.textContent).toBe(getCopyGuidance(null, 'text'));
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
    expect(hint.textContent).toBe(getCopyGuidance(ERRORS.CLIPBOARD_WRITE_FAILED, 'text'));

    fail = false;
    await copyFromButton(button);
    expect(label.textContent).toBe('Copied');
    expect(hint).toStrictEqual({ textContent: '', hidden: true });
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
  /**
   * Builds a fake document that records its click listeners.
   * @returns The document and its listeners.
   */
  const createDocument = (): { root: Document; listeners: unknown[] } => {
    const attributes = new Set<string>();
    const listeners: unknown[] = [];
    const root = {
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

    expect(listeners).toStrictEqual([['click', handleCopyClick]]);
  });

  test("registers on the page's document by default", () => {
    const { root, listeners } = createDocument();
    vi.stubGlobal('document', root);

    registerCopyButtons();

    expect(listeners).toHaveLength(1);
  });
});
