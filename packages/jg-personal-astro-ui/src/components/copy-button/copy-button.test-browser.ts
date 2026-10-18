import { ERRORS } from 'jg-clipboard';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { renderCodeWindowHeader } from '../code-block/code-window.ts';
import { registerCopyButtons } from './copy-behavior.ts';
import { renderCopyButton } from './copy-button-markup.ts';
import { getCopyGuidance } from './copy-guidance.ts';

/*
 * The copy buttons' real markup and behavior in Chromium, Firefox, and WebKit. The clipboard and the
 * signals jg-clipboard reads to name a refusal are stubbed, so each failure is reproducible in
 * every engine.
 */

// the code the code window shows
const CODE = "import { copyText } from 'jg-clipboard';\n\nawait copyText('hi');";

// the refusal browsers report when they block a clipboard write
const NOT_ALLOWED = (): DOMException =>
  new DOMException('Write permission denied.', 'NotAllowedError');

/**
 * Renders a code window with its copy button.
 * @returns The copy button.
 */
const renderCodeWindow = (): HTMLButtonElement => {
  const code = document.createElement('code');
  code.textContent = CODE;
  const pre = document.createElement('pre');
  pre.append(code);
  const figure = document.createElement('figure');
  figure.className = 'jg-code-window';
  figure.dataset['codeWindow'] = '';
  figure.innerHTML = renderCodeWindowHeader({ caption: 'ts' });
  figure.append(pre);
  document.body.append(figure);
  return figure.querySelector('button') as HTMLButtonElement;
};

/**
 * Clicks a copy button and waits for its outcome.
 * @param button The copy button.
 * @returns A promise that resolves to the label, the status, and the hint it shows.
 */
const clickAndRead = async (
  button: HTMLButtonElement,
): Promise<{ state: string | undefined; label: string; status: string; hint: string | null }> => {
  button.click();
  await expect.poll(() => button.dataset['copyState']).toBeDefined();
  const wrapper = button.parentElement as HTMLElement;
  const hint = wrapper.querySelector<HTMLElement>('[data-copy-hint]') as HTMLElement;
  return {
    state: button.dataset['copyState'],
    label: button.querySelector('[data-copy-label]')?.textContent ?? '',
    status: wrapper.querySelector('[data-copy-status]')?.textContent ?? '',
    hint: hint.hidden ? null : hint.textContent,
  };
};

/**
 * Makes the browser look focused and inside a click, so a refusal reads as a denied permission.
 */
const stubActivePage = (): void => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  vi.spyOn(navigator, 'userActivation', 'get').mockReturnValue({
    isActive: true,
    hasBeenActive: true,
  });
};

beforeAll(() => {
  registerCopyButtons();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('copy buttons', () => {
  test("copy their code window's code and show Copied", async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    const outcome = await clickAndRead(renderCodeWindow());

    expect(writeText).toHaveBeenCalledWith(CODE);
    expect(outcome).toStrictEqual({
      state: 'success',
      label: 'Copied',
      status: 'Copied to the clipboard.',
      hint: null,
    });
  });

  test('copy their own text', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    document.body.innerHTML = renderCopyButton({
      text: 'npm install jg-clipboard',
      context: 'npm install command',
    });

    await clickAndRead(document.querySelector('button') as HTMLButtonElement);

    expect(writeText).toHaveBeenCalledWith('npm install jg-clipboard');
  });

  test('keep their box while a shorter label shows, copy after copy, and let go once it resets', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    document.body.innerHTML = renderCopyButton({
      context: 'install command',
      label: 'Copy install command',
      text: 'npm install jg-clipboard',
    });
    const button = document.querySelector('button') as HTMLButtonElement;
    const resting = button.getBoundingClientRect();

    for (let copy = 1; copy <= 2; copy += 1) {
      const outcome = await clickAndRead(button);
      const shown = button.getBoundingClientRect();
      expect(outcome.label).toBe('Copied');
      expect([shown.width, shown.height]).toStrictEqual([resting.width, resting.height]);
    }

    vi.advanceTimersByTime(2_000);
    expect(button.style.minWidth).toBe('');
    vi.useRealTimers();
  });

  test('copy the text at their URL, and show their own label again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const markdown = '# jg-clipboard\n\nCopy and read the clipboard.\n';
    const fetch = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(markdown));
    // the clipboard reads the item it's given, as browsers do
    const write = vi.spyOn(navigator.clipboard, 'write').mockImplementation(async ([item]) => {
      await item?.getType('text/plain');
    });
    document.body.innerHTML = renderCopyButton({
      context: 'as Markdown',
      label: 'Copy page',
      tone: 'outline',
      url: '/packages/jg-clipboard/index.md',
    });
    const button = document.querySelector('button') as HTMLButtonElement;

    const outcome = await clickAndRead(button);

    const item = write.mock.calls[0]?.[0][0];
    expect(await (await item?.getType('text/plain'))?.text()).toBe(markdown);
    expect(fetch).toHaveBeenCalledWith('/packages/jg-clipboard/index.md');
    expect(outcome.label).toBe('Copied');
    vi.advanceTimersByTime(2_000);
    expect(button.textContent).toBe('Copy page as Markdown');
    vi.useRealTimers();
  });

  test('link to the text at their URL when it fails to load', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response('Server error', { status: 500 }));
    vi.spyOn(navigator.clipboard, 'write').mockImplementation(async ([item]) => {
      await item?.getType('text/plain');
    });
    document.body.innerHTML = renderCopyButton({
      context: 'as Markdown',
      label: 'Copy page',
      url: '/packages/jg-clipboard/index.md',
    });

    const outcome = await clickAndRead(document.querySelector('button') as HTMLButtonElement);

    const guidance = getCopyGuidance(ERRORS.CLIPBOARD_WRITE_FAILED, {
      context: 'as Markdown',
      label: 'Copy page',
      linked: true,
    });
    const link = document.querySelector<HTMLAnchorElement>('[data-copy-hint] a');
    expect(outcome).toStrictEqual({
      state: 'error',
      label: 'Copy failed',
      status: guidance,
      hint: `${guidance}/packages/jg-clipboard/index.md`,
    });
    expect(link?.getAttribute('href')).toBe('/packages/jg-clipboard/index.md');
    expect(link?.checkVisibility()).toBe(true);
  });

  test.each([
    [
      ERRORS.CLIPBOARD_PERMISSION_DENIED,
      (): void => {
        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(NOT_ALLOWED());
        stubActivePage();
        vi.spyOn(navigator.permissions, 'query').mockResolvedValue({
          state: 'denied',
        } as PermissionStatus);
      },
    ],
    [
      ERRORS.CLIPBOARD_NO_USER_GESTURE,
      (): void => {
        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(NOT_ALLOWED());
        stubActivePage();
        vi.spyOn(navigator, 'userActivation', 'get').mockReturnValue({
          isActive: false,
          hasBeenActive: false,
        });
      },
    ],
    [
      ERRORS.CLIPBOARD_NOT_FOCUSED,
      (): void => {
        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(NOT_ALLOWED());
        vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      },
    ],
    [
      ERRORS.CLIPBOARD_UNSUPPORTED,
      (): void => {
        vi.spyOn(navigator, 'clipboard', 'get').mockReturnValue(undefined as unknown as Clipboard);
      },
    ],
    [
      ERRORS.CLIPBOARD_WRITE_FAILED,
      (): void => {
        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Disk full.'));
      },
    ],
  ])('show the guidance for %s', async (code, stub) => {
    stub();

    const outcome = await clickAndRead(renderCodeWindow());

    const guidance = getCopyGuidance(code, { context: 'code' });
    expect(outcome).toStrictEqual({
      state: 'error',
      label: 'Copy failed',
      status: guidance,
      hint: guidance,
    });
  });
});
