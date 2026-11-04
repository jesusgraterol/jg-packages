import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { Avatar } from './avatar.component.js';
import type { IAvatarProps } from './types.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// a one-pixel PNG that loads, and bytes that no browser decodes
const LOADING_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const BROKEN_IMAGE = 'data:image/png;base64,AAAA';

describe('Avatar', () => {
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

  const renderAvatar = (props: IAvatarProps): void => {
    act(() => {
      root.render(<Avatar {...props} />);
    });
  };

  test('shows the image at its size, named by its alt', () => {
    renderAvatar({ src: LOADING_IMAGE, alt: 'Ada Lovelace', fallback: 'Ada', size: 'lg' });

    const image = container.querySelector('img') as HTMLImageElement;
    expect(image.alt).toBe('Ada Lovelace');
    expect(image.width).toBe(36);
    expect(image.height).toBe(36);
    expect(image.loading).toBe('lazy');
    expect(image.dataset['fit']).toBe('cover');
    expect(image.className).toContain('object-cover');
    expect(container.querySelector('[data-slot="avatar"]')?.className).toContain('size-9');
  });

  test('falls back to the same-size initial when the image fails to load, and tries a new image', async () => {
    renderAvatar({ src: BROKEN_IMAGE, alt: 'Ada Lovelace', fallback: 'ada', size: 'sm' });

    const tile = await vi.waitFor(() => {
      const fallback = container.querySelector<HTMLElement>('[data-initial]');
      expect(fallback).not.toBeNull();
      return fallback as HTMLElement;
    });
    expect(tile.dataset['initial']).toBe('a');
    expect(tile.className).toContain('uppercase');
    expect(tile.className).toContain('size-5');
    expect(tile.getAttribute('role')).toBe('img');
    expect(tile.getAttribute('aria-label')).toBe('Ada Lovelace');
    expect(container.querySelector('img')).toBeNull();

    renderAvatar({ src: LOADING_IMAGE, alt: 'Ada Lovelace', fallback: 'ada', size: 'sm' });

    expect(container.querySelector('img')?.src).toBe(LOADING_IMAGE);
  });

  test('keeps a decorative fallback out of the accessibility tree', () => {
    renderAvatar({ src: null, alt: '', fallback: '?', size: 'xs', className: 'rounded-full' });

    const tile = container.querySelector<HTMLElement>('[data-slot="avatar"]') as HTMLElement;
    expect(tile.getAttribute('aria-hidden')).toBe('true');
    expect(tile.getAttribute('role')).toBeNull();
    expect(tile.dataset['initial']).toBe('?');
    expect(tile.className).toContain('rounded-full');
    expect(tile.textContent).toBe('');
  });

  test('insets a logo on its tile', () => {
    renderAvatar({
      src: LOADING_IMAGE,
      alt: '',
      fallback: 'Codex',
      fit: 'inset',
      className: 'bg-codex-tint',
      imageClassName: 'dark:invert',
    });

    const image = container.querySelector('img') as HTMLImageElement;
    expect(image.alt).toBe('');
    expect(image.dataset['fit']).toBe('inset');
    expect(image.className).toContain('object-contain');
    expect(image.className).toContain('dark:invert');
    const tile = container.querySelector<HTMLElement>('[data-slot="avatar"]') as HTMLElement;
    expect(tile.className).toContain('bg-codex-tint');
    expect(tile.className).toContain('[&_[data-fit=inset]]:size-4');
  });
});
