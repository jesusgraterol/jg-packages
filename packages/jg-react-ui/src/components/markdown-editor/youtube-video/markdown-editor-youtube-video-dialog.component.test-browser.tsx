import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { parseYouTubeVideoUrl } from '../../../shared/youtube-video/index.js';

import { MarkdownEditorYouTubeVideoDialog } from './markdown-editor-youtube-video-dialog.component.js';

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Changes a controlled input through React's native input boundary.
 * @param input The input element to update.
 * @param nextValue The next controlled value.
 */
const changeInput = (input: HTMLInputElement, nextValue: string): void => {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.bind(input);

  valueSetter?.(nextValue);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('MarkdownEditorYouTubeVideoDialog', () => {
  let container: HTMLDivElement;
  let returnFocusElement: HTMLButtonElement;
  let root: Root;
  let originalActEnvironment: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalActEnvironment = Object.getOwnPropertyDescriptor(
      globalThis,
      'IS_REACT_ACT_ENVIRONMENT',
    );
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    returnFocusElement = document.createElement('button');
    returnFocusElement.type = 'button';
    document.body.append(container, returnFocusElement);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    returnFocusElement.remove();
    document.querySelectorAll('[data-slot="dialog-portal"]').forEach((portal) => {
      portal.remove();
    });
    vi.clearAllMocks();
    if (originalActEnvironment)
      Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActEnvironment);
    else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  });

  test('renders accessible add fields and realistic placeholders', async () => {
    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoDialog
          mode="add"
          open={false}
          resolveReturnFocusElement={() => returnFocusElement}
          onClosed={vi.fn()}
          onOpenChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );

      await Promise.resolve();
    });

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoDialog
          mode="add"
          open
          resolveReturnFocusElement={() => returnFocusElement}
          onClosed={vi.fn()}
          onOpenChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );

      await Promise.resolve();
    });

    const urlInput = document.querySelector<HTMLInputElement>('[name="youtubeVideoUrl"]');
    const titleInput = document.querySelector<HTMLInputElement>('[name="youtubeVideoTitle"]');

    expect(document.querySelector('[data-slot="dialog-title"]')?.textContent).toBe(
      'Add YouTube video',
    );
    expect(urlInput?.required).toBe(true);
    expect(urlInput?.placeholder).toBe('e.g. https://www.youtube.com/watch?v=M7lc1UVf-VE');
    expect(titleInput?.placeholder).toBe('e.g. Product walkthrough');
    expect(document.querySelector(`label[for="${urlInput?.id}"]`)?.textContent).toBe('YouTube URL');
    expect(document.querySelector(`label[for="${titleInput?.id}"]`)?.textContent).toBe(
      'Title (optional)',
    );
    await act(async () => {
      await vi.waitFor(() => expect(document.activeElement).toBe(urlInput));
    });
  });

  test('loads canonical edit values and exposes the save action', async () => {
    const initialDescriptor = parseYouTubeVideoUrl(
      'https://youtu.be/M7lc1UVf-VE?t=15',
      'Product walkthrough',
    );

    if (!initialDescriptor) {
      throw new Error('Expected the YouTube fixture to be valid.');
    }

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoDialog
          initialDescriptor={initialDescriptor}
          mode="edit"
          open
          resolveReturnFocusElement={() => returnFocusElement}
          onClosed={vi.fn()}
          onOpenChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );

      await Promise.resolve();
    });

    expect(document.querySelector('[data-slot="dialog-title"]')?.textContent).toBe(
      'Edit YouTube video',
    );
    expect(document.querySelector<HTMLInputElement>('[name="youtubeVideoUrl"]')?.value).toBe(
      'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    );
    expect(document.querySelector<HTMLInputElement>('[name="youtubeVideoTitle"]')?.value).toBe(
      'Product walkthrough',
    );
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toBe(
      'Save',
    );
  });

  test('keeps invalid input open with an actionable inline error', async () => {
    const onSubmit = vi.fn();

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoDialog
          mode="add"
          open
          resolveReturnFocusElement={() => returnFocusElement}
          onClosed={vi.fn()}
          onOpenChange={vi.fn()}
          onSubmit={onSubmit}
        />,
      );

      await Promise.resolve();
    });

    const urlInput = document.querySelector<HTMLInputElement>('[name="youtubeVideoUrl"]');
    const form = document.querySelector<HTMLFormElement>('form');

    if (!urlInput || !form) {
      throw new Error('Expected the YouTube dialog form to render.');
    }

    await act(async () => {
      changeInput(urlInput, 'https://example.com/video');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await Promise.resolve();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(urlInput.getAttribute('aria-invalid')).toBe('true');
    const alert = document.querySelector<HTMLElement>('[role="alert"]');

    expect(alert?.textContent).toBe('Enter a supported HTTPS YouTube video URL.');
    expect(urlInput.getAttribute('aria-describedby')).toBe(alert?.id);
    expect(form.noValidate).toBe(true);
  });

  test('resets authored values and errors when the dialog session changes', async () => {
    const initialDescriptor = parseYouTubeVideoUrl(
      'https://youtu.be/M7lc1UVf-VE',
      'Replacement session',
    );

    if (!initialDescriptor) {
      throw new Error('Expected the YouTube fixture to be valid.');
    }

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoDialog
          mode="add"
          open
          resolveReturnFocusElement={() => returnFocusElement}
          onClosed={vi.fn()}
          onOpenChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );

      await Promise.resolve();
    });

    const urlInput = document.querySelector<HTMLInputElement>('[name="youtubeVideoUrl"]');
    const form = document.querySelector<HTMLFormElement>('form');

    if (!urlInput || !form) {
      throw new Error('Expected the YouTube dialog form to render.');
    }

    await act(async () => {
      changeInput(urlInput, 'invalid');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(document.querySelector('[role="alert"]')).not.toBeNull();

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoDialog
          initialDescriptor={initialDescriptor}
          mode="edit"
          open
          resolveReturnFocusElement={() => returnFocusElement}
          onClosed={vi.fn()}
          onOpenChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
      await Promise.resolve();
    });

    expect(document.querySelector<HTMLInputElement>('[name="youtubeVideoUrl"]')?.value).toBe(
      'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    );
    expect(document.querySelector<HTMLInputElement>('[name="youtubeVideoTitle"]')?.value).toBe(
      'Replacement session',
    );
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  test('normalizes submission and restores focus to a replacement target after cancellation', async () => {
    const onClosed = vi.fn();
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoDialog
          mode="add"
          open
          resolveReturnFocusElement={() => returnFocusElement}
          onClosed={onClosed}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />,
      );

      await Promise.resolve();
    });

    const urlInput = document.querySelector<HTMLInputElement>('[name="youtubeVideoUrl"]');
    const titleInput = document.querySelector<HTMLInputElement>('[name="youtubeVideoTitle"]');
    const form = document.querySelector<HTMLFormElement>('form');

    if (!urlInput || !titleInput || !form) {
      throw new Error('Expected the YouTube dialog form to render.');
    }

    await act(async () => {
      changeInput(urlInput, ' https://youtu.be/M7lc1UVf-VE?t=15 ');
      changeInput(titleInput, ' Product walkthrough ');
      form.requestSubmit();

      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith({
      embedUrl: 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
      title: 'Product walkthrough',
      videoId: 'M7lc1UVf-VE',
      watchUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    });

    const closeButton = document.querySelector<HTMLButtonElement>('[aria-label="Close dialog"]');

    if (!closeButton) {
      throw new Error('Expected the dialog close button to render.');
    }

    const replacementFocusElement = document.createElement('button');

    replacementFocusElement.type = 'button';
    document.body.append(replacementFocusElement);
    returnFocusElement.remove();
    returnFocusElement = replacementFocusElement;

    await act(async () => {
      closeButton.click();

      await Promise.resolve();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoDialog
          mode="add"
          open={false}
          resolveReturnFocusElement={() => returnFocusElement}
          onClosed={onClosed}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      await vi.waitFor(() => expect(document.activeElement).toBe(returnFocusElement));
    });
    await vi.waitFor(() => {
      expect(onClosed).toHaveBeenCalledOnce();
    });
  });

  test('abandons focus restoration when no target survives dismissal', async () => {
    const onClosed = vi.fn();
    let resolvedFocusElement: HTMLElement | null = returnFocusElement;

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoDialog
          mode="edit"
          open
          resolveReturnFocusElement={() => resolvedFocusElement}
          onClosed={onClosed}
          onOpenChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );

      await Promise.resolve();
    });

    resolvedFocusElement = null;
    returnFocusElement.remove();

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoDialog
          mode="edit"
          open={false}
          resolveReturnFocusElement={() => resolvedFocusElement}
          onClosed={onClosed}
          onOpenChange={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
      await Promise.resolve();
    });

    await act(async () => {
      await vi.waitFor(() => expect(onClosed).toHaveBeenCalledOnce());
    });

    const delayedFocusElement = document.createElement('button');
    const retainedFocusElement = document.createElement('button');
    const unrelatedInertElement = document.createElement('div');

    try {
      document.body.append(delayedFocusElement, retainedFocusElement, unrelatedInertElement);
      resolvedFocusElement = delayedFocusElement;
      retainedFocusElement.focus();

      await act(async () => {
        unrelatedInertElement.setAttribute('data-base-ui-inert', '');
        await Promise.resolve();
        unrelatedInertElement.removeAttribute('data-base-ui-inert');
        await Promise.resolve();
      });

      expect(document.activeElement).toBe(retainedFocusElement);
    } finally {
      delayedFocusElement.remove();
      retainedFocusElement.remove();
      unrelatedInertElement.remove();
    }
  });

  test('restores focus only after an outer modal releases its inert editor target', async () => {
    const inertParent = document.createElement('div');
    document.body.append(inertParent);
    inertParent.append(returnFocusElement);
    try {
      const props = {
        mode: 'add' as const,
        onClosed: vi.fn(),
        onOpenChange: vi.fn(),
        onSubmit: vi.fn(),
        resolveReturnFocusElement: () => returnFocusElement,
      };
      await act(async () => {
        root.render(
          <MarkdownEditorYouTubeVideoDialog
            {...props}
            open
          />,
        );
        await Promise.resolve();
      });
      act(() => {
        flushSync(() =>
          root.render(
            <MarkdownEditorYouTubeVideoDialog
              {...props}
              open={false}
            />,
          ),
        );
        inertParent.inert = true;
        inertParent.setAttribute('data-base-ui-inert', '');
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(document.activeElement).not.toBe(returnFocusElement);
      await act(async () => {
        inertParent.inert = false;
        inertParent.removeAttribute('data-base-ui-inert');
        await Promise.resolve();
      });
      await act(async () => {
        await vi.waitFor(() => expect(document.activeElement).toBe(returnFocusElement));
      });
    } finally {
      inertParent.remove();
    }
  });

  test('a same-turn route unmount cancels queued focus restoration', async () => {
    const nextPageFocus = document.createElement('button');
    document.body.append(nextPageFocus);
    try {
      await act(async () => {
        root.render(
          <MarkdownEditorYouTubeVideoDialog
            mode="add"
            open
            onClosed={vi.fn()}
            onOpenChange={vi.fn()}
            onSubmit={vi.fn()}
            resolveReturnFocusElement={() => returnFocusElement}
          />,
        );
        await Promise.resolve();
      });
      act(() => {
        flushSync(() => {
          root.render(
            <MarkdownEditorYouTubeVideoDialog
              mode="add"
              open={false}
              onClosed={vi.fn()}
              onOpenChange={vi.fn()}
              onSubmit={vi.fn()}
              resolveReturnFocusElement={() => returnFocusElement}
            />,
          );
        });
        root.unmount();
        nextPageFocus.focus();
      });
      await Promise.resolve();
      expect(document.activeElement).toBe(nextPageFocus);
    } finally {
      nextPageFocus.remove();
    }
  });
});
