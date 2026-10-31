import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { parseYouTubeVideoUrl } from '../../shared/youtube-video/index.js';

import { YouTubeVideo } from './index.js';

const VIDEO_ID = 'M7lc1UVf-VE';
const YOUTUBE_VIDEO_DESCRIPTOR = parseYouTubeVideoUrl(
  `https://www.youtube.com/watch?v=${VIDEO_ID}&autoplay=1&t=30`,
  'Product walkthrough',
);

if (!YOUTUBE_VIDEO_DESCRIPTOR) {
  throw new Error('The YouTube video test fixture must be valid.');
}

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('YouTubeVideo', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
  });

  test('renders the fixed privacy, permission, and accessibility contract', () => {
    act(() => {
      root.render(
        <YouTubeVideo
          title={YOUTUBE_VIDEO_DESCRIPTOR.title}
          videoId={YOUTUBE_VIDEO_DESCRIPTOR.videoId}
        />,
      );
    });

    const iframe = container.querySelector('iframe');

    expect(iframe?.getAttribute('src')).toBe(`https://www.youtube-nocookie.com/embed/${VIDEO_ID}`);
    expect(iframe?.getAttribute('src')).not.toContain('autoplay');
    expect(iframe?.getAttribute('allow')).toBe('encrypted-media; picture-in-picture');
    expect(iframe?.getAttribute('allow')).not.toContain('autoplay');
    expect(iframe?.hasAttribute('allowfullscreen')).toBe(true);
    expect(iframe?.getAttribute('loading')).toBe('lazy');
    expect(iframe?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(iframe?.getAttribute('title')).toBe('Product walkthrough');
  });

  test('uses fluid responsive sizing and semantic theme tokens', { tags: ['full'] }, () => {
    act(() => {
      root.render(
        <YouTubeVideo
          className="mt-6"
          title={YOUTUBE_VIDEO_DESCRIPTOR.title}
          videoId={YOUTUBE_VIDEO_DESCRIPTOR.videoId}
        />,
      );
    });

    const wrapper = container.querySelector<HTMLElement>('[data-slot="youtube-video"]');
    const iframe = container.querySelector('iframe');

    expect(wrapper?.className).toContain('aspect-video');
    expect(wrapper?.className).toContain('min-h-50');
    expect(wrapper?.className).toContain('w-full');
    expect(wrapper?.className).toContain('min-w-0');
    expect(wrapper?.className).toContain('bg-background');
    expect(wrapper?.className).toContain('border-border');
    expect(wrapper?.className).toContain('shadow-surface');
    expect(wrapper?.className).toContain('focus-within:ring-foreground');
    expect(wrapper?.className).toContain('mt-6');
    expect(wrapper?.className).not.toMatch(/(?:^|\s)w-\[/);
    expect(iframe?.className).toContain('h-full');
    expect(iframe?.className).toContain('min-h-50');
    expect(iframe?.className).toContain('w-full');
  });

  test('enables autoplay only through the explicit prop and removes it when disabled', () => {
    for (const autoPlay of [false, true, false]) {
      act(() => {
        root.render(
          <YouTubeVideo
            autoPlay={autoPlay}
            title={YOUTUBE_VIDEO_DESCRIPTOR.title}
            videoId={YOUTUBE_VIDEO_DESCRIPTOR.videoId}
          />,
        );
      });

      const iframe = container.querySelector('iframe');

      expect(iframe?.getAttribute('src')).toBe(
        `https://www.youtube-nocookie.com/embed/${VIDEO_ID}${autoPlay ? '?autoplay=1' : ''}`,
      );
      expect(iframe?.getAttribute('allow')).toBe(
        autoPlay
          ? 'autoplay; encrypted-media; picture-in-picture'
          : 'encrypted-media; picture-in-picture',
      );
      expect(iframe?.getAttribute('title')).toBe('Product walkthrough');
      expect(iframe?.hasAttribute('allowfullscreen')).toBe(true);
    }
  });
});
