import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// the native text-write boundary remains controlled while the real copy component runs.
const clipboardMock = vi.hoisted(() => ({
  writeText: vi.fn<(value: string) => Promise<void>>(),
}));

import { toastr } from '../toastr/index.js';
import { ErrorFeedbackProvider } from '../error-feedback-provider/index.js';

import { COPY_BUTTON_FEEDBACK_DURATION_MS, CopyButton } from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Returns the rendered copy button.
 * @param container The test container to search.
 * @returns The copy button element.
 */
const getCopyButton = (container: HTMLElement): HTMLButtonElement => {
  const button = container.querySelector<HTMLButtonElement>('button');

  if (button === null) {
    throw new Error('Copy button was not found.');
  }

  return button;
};

describe('CopyButton', () => {
  let container: HTMLDivElement;
  let root: Root;
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.spyOn(toastr, 'error').mockReturnValue(0);
    clipboardMock.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboardMock });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
      vi.runOnlyPendingTimers();
    });
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  test('writes the provided value and shows copied feedback', async () => {
    await act(async () => {
      root.render(<CopyButton value="admin-id-1" />);

      await Promise.resolve();
    });

    const button = getCopyButton(container);

    expect(button.dataset['copied']).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Copy to Clipboard');
    expect(container.querySelector('[role="status"]')).toBeNull();

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    const successIcon = button.querySelector('[data-slot="copy-button-success-icon"]');
    const clipboardIcon = button.querySelector('[data-slot="copy-button-clipboard-icon"]');

    expect(clipboardMock.writeText).toHaveBeenCalledWith('admin-id-1');
    expect(button.dataset['copied']).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Copied to Clipboard');
    expect(clipboardIcon?.getAttribute('class')).toContain('motion-reduce:transition-none');
    expect(successIcon?.getAttribute('class')).toContain('motion-reduce:transition-none');
    expect(successIcon?.getAttribute('class')).not.toContain('text-chart-1');
    expect(successIcon?.getAttribute('class')).toContain('opacity-100');

    act(() => {
      vi.advanceTimersByTime(COPY_BUTTON_FEEDBACK_DURATION_MS);
    });

    expect(button.dataset['copied']).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Copy to Clipboard');
  });

  test.each(['Copy full document', 'Copy loaded source'])(
    'preserves %s through pending, successful and reset feedback',
    { tags: ['full'] },
    async (copyLabel) => {
      let finishWrite!: () => void;
      clipboardMock.writeText.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        }),
      );
      await act(async () => {
        root.render(
          <CopyButton
            copyLabel={copyLabel}
            value="complete source"
          />,
        );
        await Promise.resolve();
      });
      const button = getCopyButton(container);
      const status = container.querySelector('[role="status"]');

      expect(status).not.toBeNull();
      expect(status?.textContent).toBe('');
      expect(button.getAttribute('aria-label')).toBe(copyLabel);
      expect(button.title).toBe(copyLabel);
      expect(button.hasAttribute('copylabel')).toBe(false);

      await act(async () => {
        button.click();
        await Promise.resolve();
      });
      expect(clipboardMock.writeText).toHaveBeenCalledExactlyOnceWith('complete source');
      expect(button.getAttribute('aria-label')).toBe(copyLabel);
      expect(button.title).toBe(copyLabel);
      expect(status?.textContent).toBe('');

      await act(async () => {
        finishWrite();
        await Promise.resolve();
      });
      expect(button.getAttribute('aria-label')).toBe('Copied to Clipboard');
      expect(button.title).toBe('Copied to Clipboard');
      expect(status?.textContent).toBe('Copied to Clipboard');
      expect(status?.textContent).not.toContain('complete source');

      act(() => {
        vi.advanceTimersByTime(COPY_BUTTON_FEEDBACK_DURATION_MS);
      });
      expect(button.getAttribute('aria-label')).toBe(copyLabel);
      expect(button.title).toBe(copyLabel);
      expect(status?.textContent).toBe('');
      expect(container.querySelector('[role="status"]')).toBe(status);
    },
  );

  test.each(['rejected', 'unavailable'] as const)(
    'retains scoped ready feedback for a %s clipboard write',
    async (failure) => {
      if (failure === 'unavailable') {
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
      } else {
        clipboardMock.writeText.mockRejectedValueOnce(new Error('Permission denied'));
      }
      await act(async () => {
        root.render(
          <CopyButton
            copyLabel="Copy full document"
            value="complete source"
          />,
        );
        await Promise.resolve();
      });
      const button = getCopyButton(container);
      await act(async () => {
        button.click();
        await Promise.resolve();
      });

      expect(button.getAttribute('aria-label')).toBe('Copy full document');
      expect(button.title).toBe('Copy full document');
      expect(button.dataset['copied']).toBe('false');
      expect(container.querySelector('[role="status"]')?.textContent).toBe('');
      expect(toastr.error).toHaveBeenCalledExactlyOnceWith('Failed to write to Clipboard', {
        description: 'We could not copy this text. Select it and copy it manually.',
      });
    },
  );

  test('clears earlier success when another scoped attempt starts and fails', async () => {
    await act(async () => {
      root.render(
        <CopyButton
          copyLabel="Copy loaded source"
          value="loaded source"
        />,
      );
      await Promise.resolve();
    });
    const button = getCopyButton(container);
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Copied to Clipboard');

    let rejectWrite!: (error: unknown) => void;
    clipboardMock.writeText.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        rejectWrite = reject;
      }),
    );
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(button.getAttribute('aria-label')).toBe('Copy loaded source');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');

    await act(async () => {
      rejectWrite(new Error('Permission denied'));
      await Promise.resolve();
    });
    expect(button.dataset['copied']).toBe('false');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');
    expect(vi.getTimerCount()).toBe(0);
    expect(toastr.error).toHaveBeenCalledTimes(1);
  });

  test(
    'preserves literal native naming and title overrides with a scoped label',
    { tags: ['full'] },
    async () => {
      await act(async () => {
        root.render(
          <CopyButton
            aria-label="Literal copy command"
            title="Literal tooltip"
            copyLabel="Copy full document"
            value="complete source"
          />,
        );
        await Promise.resolve();
      });
      const button = getCopyButton(container);
      expect(button.getAttribute('aria-label')).toBe('Literal copy command');
      expect(button.title).toBe('Literal tooltip');
      await act(async () => {
        button.click();
        await Promise.resolve();
      });
      expect(button.getAttribute('aria-label')).toBe('Literal copy command');
      expect(button.title).toBe('Literal tooltip');
      expect(container.querySelector('[role="status"]')?.textContent).toBe('Copied to Clipboard');
    },
  );

  test(
    'shows optional visible labels for the ready and copied states',
    { tags: ['full'] },
    async () => {
      await act(async () => {
        root.render(
          <CopyButton
            copiedLabel="Prompt copied"
            copyLabel="Copy full document"
            label="Copy prompt"
            value="resolution-prompt"
          />,
        );

        await Promise.resolve();
      });

      const button = getCopyButton(container);

      expect(button.textContent).toBe('Copy prompt');
      expect(button.getAttribute('aria-label')).toBe('Copy prompt');

      await act(async () => {
        button.click();
        await Promise.resolve();
      });

      expect(button.textContent).toBe('Prompt copied');
      expect(button.getAttribute('aria-label')).toBe('Prompt copied');

      act(() => {
        vi.advanceTimersByTime(COPY_BUTTON_FEEDBACK_DURATION_MS);
      });

      expect(button.textContent).toBe('Copy prompt');
      expect(button.getAttribute('aria-label')).toBe('Copy prompt');
    },
  );

  test('keeps the button enabled while preventing concurrent clipboard writes', async () => {
    let resolveClipboardWrite: (() => void) | undefined;
    const clipboardWritePromise = new Promise<void>((resolve) => {
      resolveClipboardWrite = resolve;
    });

    clipboardMock.writeText.mockReturnValueOnce(clipboardWritePromise);

    await act(async () => {
      root.render(
        <CopyButton
          copyLabel="Copy loaded source"
          value="admin-id-1"
        />,
      );

      await Promise.resolve();
    });

    const button = getCopyButton(container);

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Copy loaded source');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('');

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(clipboardMock.writeText).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveClipboardWrite?.();
      await clipboardWritePromise;
    });

    expect(button.dataset['copied']).toBe('true');
  });

  test('shows an error toastr when the clipboard write fails', async () => {
    clipboardMock.writeText.mockRejectedValue(new Error('Permission denied'));

    await act(async () => {
      root.render(<CopyButton value="admin-id-2" />);

      await Promise.resolve();
    });

    const button = getCopyButton(container);

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(clipboardMock.writeText).toHaveBeenCalledWith('admin-id-2');
    expect(button.dataset['copied']).toBe('false');
    expect(toastr.error).toHaveBeenCalledWith('Failed to write to Clipboard', {
      description: 'We could not copy this text. Select it and copy it manually.',
    });
  });

  test('invokes text writing synchronously in the first click without read capabilities', async () => {
    let finishWrite!: () => void;
    clipboardMock.writeText.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
    );
    await act(async () => {
      root.render(<CopyButton value="https://example.com/sign-up?partner=sample" />);
      await Promise.resolve();
    });
    const button = getCopyButton(container);
    act(() => {
      button.click();
      expect(clipboardMock.writeText).toHaveBeenCalledExactlyOnceWith(
        'https://example.com/sign-up?partner=sample',
      );
      expect(button.dataset['copied']).toBe('false');
    });
    await act(async () => {
      finishWrite();
      await Promise.resolve();
    });
    expect(button.dataset['copied']).toBe('true');
  });

  test('reports unavailable text writes truthfully with manual copying guidance', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    await act(async () => {
      root.render(<CopyButton value="manual-copy" />);
      await Promise.resolve();
    });
    await act(async () => {
      getCopyButton(container).click();
      await Promise.resolve();
    });
    expect(clipboardMock.writeText).not.toHaveBeenCalled();
    expect(getCopyButton(container).dataset['copied']).toBe('false');
    expect(toastr.error).toHaveBeenCalledExactlyOnceWith('Failed to write to Clipboard', {
      description: 'We could not copy this text. Select it and copy it manually.',
    });
  });

  test.each([false, true])(
    'does not retain feedback after an unmounted write settles (reject=%s)',
    async (shouldReject) => {
      let resolveWrite!: () => void;
      let rejectWrite!: (error: unknown) => void;
      clipboardMock.writeText.mockReturnValueOnce(
        new Promise<void>((resolve, reject) => {
          resolveWrite = resolve;
          rejectWrite = reject;
        }),
      );
      await act(async () => {
        root.render(
          <CopyButton
            copyLabel="Copy loaded source"
            value="pending-copy"
          />,
        );
        await Promise.resolve();
      });
      await act(async () => {
        getCopyButton(container).click();
        await Promise.resolve();
      });
      act(() => root.unmount());
      const pendingTimers = vi.getTimerCount();
      await act(async () => {
        if (shouldReject) rejectWrite(new Error('denied'));
        else resolveWrite();

        await Promise.resolve();
      });
      expect(vi.getTimerCount()).toBe(pendingTimers);
      expect(toastr.error).not.toHaveBeenCalled();
    },
  );

  test('cancellation remains silent and a pending write uses the latest scoped feedback policy', async () => {
    clipboardMock.writeText.mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'));
    await act(async () => {
      root.render(<CopyButton value="cancelled" />);
      await Promise.resolve();
    });
    await act(async () => {
      getCopyButton(container).click();
      await Promise.resolve();
    });
    expect(toastr.error).not.toHaveBeenCalled();
    let rejectWrite!: (error: unknown) => void;
    clipboardMock.writeText.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        rejectWrite = reject;
      }),
    );
    const policy = (message: string) => () => ({
      message,
      code: null,
      isCancelled: false,
      isAccessDenied: false,
    });
    await act(async () => {
      root.render(
        <ErrorFeedbackProvider resolveErrorFeedback={policy('Earlier policy')}>
          <CopyButton value="pending" />
        </ErrorFeedbackProvider>,
      );
      await Promise.resolve();
    });
    await act(async () => {
      getCopyButton(container).click();
      await Promise.resolve();
    });
    await act(async () => {
      root.render(
        <ErrorFeedbackProvider resolveErrorFeedback={policy('Current policy')}>
          <CopyButton value="pending" />
        </ErrorFeedbackProvider>,
      );
      await Promise.resolve();
    });
    await act(async () => {
      rejectWrite(new Error('Private diagnostic'));
      await Promise.resolve();
    });
    expect(toastr.error).toHaveBeenCalledExactlyOnceWith('Failed to write to Clipboard', {
      description: 'Current policy',
    });
  });

  test(
    'authored duration remains in milliseconds and a repeat click clears the earlier feedback timer',
    { tags: ['full'] },
    async () => {
      await act(async () => {
        root.render(
          <CopyButton
            copiedFeedbackDuration={64}
            value="repeat"
          />,
        );
        await Promise.resolve();
      });
      await act(async () => {
        getCopyButton(container).click();
        await Promise.resolve();
      });
      act(() => {
        vi.advanceTimersByTime(32);
      });
      await act(async () => {
        getCopyButton(container).click();
        await Promise.resolve();
      });
      act(() => {
        vi.advanceTimersByTime(32);
      });
      expect(getCopyButton(container).dataset['copied']).toBe('true');
      act(() => {
        vi.advanceTimersByTime(32);
      });
      expect(getCopyButton(container).dataset['copied']).toBe('false');
    },
  );
});
