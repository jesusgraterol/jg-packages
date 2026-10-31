import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { parseYouTubeVideoUrl } from '../../../shared/youtube-video/index.js';

import { MarkdownEditorYouTubeVideoNodeView } from './youtube-node-view.component.js';

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('MarkdownEditorYouTubeVideoNodeView', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalActEnvironment: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalActEnvironment = Object.getOwnPropertyDescriptor(
      globalThis,
      'IS_REACT_ACT_ENVIRONMENT',
    );
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    if (originalActEnvironment)
      Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActEnvironment);
    else Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
  });

  test('renders the shared player and semantic authoring controls', async () => {
    const descriptor = parseYouTubeVideoUrl(
      'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      'Product walkthrough',
    );
    const onEdit = vi.fn();

    if (!descriptor) {
      throw new Error('Expected the YouTube fixture to be valid.');
    }

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoNodeView
          descriptor={descriptor}
          isAuthoringEnabled
          isSelected
          onEdit={onEdit}
        />,
      );

      await Promise.resolve();
    });

    const nodeView = container.querySelector<HTMLElement>(
      '[data-slot="markdown-editor-youtube-video"]',
    );
    const editButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Edit YouTube video"]',
    );
    const openLink = container.querySelector<HTMLAnchorElement>(
      '[aria-label="Open on YouTube (opens in a new tab)"]',
    );
    const iframe = container.querySelector<HTMLIFrameElement>('iframe');

    expect(nodeView?.dataset['selected']).toBe('true');
    expect(nodeView?.className).toContain('data-[selected=true]:ring-2');
    expect(nodeView?.className).toContain('bg-background');
    expect(editButton?.className).toContain('size-11');
    expect(openLink?.href).toBe('https://www.youtube.com/watch?v=M7lc1UVf-VE');
    expect(openLink?.target).toBe('_blank');
    expect(iframe?.src).toBe('https://www.youtube-nocookie.com/embed/M7lc1UVf-VE');
    expect(container.querySelector('svg rect')).not.toBeNull();

    act(() => {
      editButton?.click();
    });

    expect(onEdit).toHaveBeenCalledWith(editButton);
  });

  test('keeps playback readable while disabled and guards edit callbacks', async () => {
    const descriptor = parseYouTubeVideoUrl('https://youtu.be/M7lc1UVf-VE');
    const onEdit = vi.fn();

    if (!descriptor) {
      throw new Error('Expected the YouTube fixture to be valid.');
    }

    await act(async () => {
      root.render(
        <MarkdownEditorYouTubeVideoNodeView
          descriptor={descriptor}
          isAuthoringEnabled={false}
          isSelected={false}
          onEdit={onEdit}
        />,
      );

      await Promise.resolve();
    });

    expect(container.querySelector('iframe')).not.toBeNull();
    expect(container.querySelector('[aria-label="Edit YouTube video"]')).toBeNull();
    expect(
      container.querySelector('[aria-label="Open on YouTube (opens in a new tab)"]'),
    ).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
  });
});
