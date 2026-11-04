import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useThemeColorMeta } from './theme-color-meta.hook.js';

const THEME_COLORS = { light: '#fefdfb', dark: '#1e2939' };

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  document.documentElement.classList.remove('light', 'dark');
  for (const tag of document.head.querySelectorAll('meta[name="theme-color"]')) {
    tag.remove();
  }
});

/**
 * Adds a theme-color tag to the page's head.
 * @param content The color it starts with.
 * @returns The tag.
 */
const addThemeColorTag = (content: string): HTMLMetaElement => {
  const tag = document.createElement('meta');
  tag.name = 'theme-color';
  tag.content = content;
  document.head.append(tag);
  return tag;
};

describe('useThemeColorMeta', { tags: ['full'] }, () => {
  test("sets every theme-color tag to the theme's color, following <html>'s theme", async () => {
    const first = addThemeColorTag('#000000');
    const second = addThemeColorTag('#000000');
    document.documentElement.classList.add('light');

    renderHook(() => {
      useThemeColorMeta(THEME_COLORS);
    });
    expect([first.content, second.content]).toStrictEqual(['#fefdfb', '#fefdfb']);

    document.documentElement.classList.replace('light', 'dark');
    await vi.waitFor(() => {
      expect([first.content, second.content]).toStrictEqual(['#1e2939', '#1e2939']);
    });
  });
});
