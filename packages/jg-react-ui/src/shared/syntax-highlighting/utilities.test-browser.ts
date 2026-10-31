import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { SYNTAX_HIGHLIGHT_COLOR_SCHEME_QUERY } from './constants.js';
import { resolveSyntaxHighlightTheme, useResolvedSyntaxHighlightTheme } from './index.js';

/**
 * Creates a mock media query list with the requested color-scheme match state.
 * @param matches Whether the media query should report a match.
 * @returns A media query list compatible with the syntax theme resolver.
 */
const createMediaQueryList = (matches: boolean): MediaQueryList =>
  ({
    matches,
    media: SYNTAX_HIGHLIGHT_COLOR_SCHEME_QUERY,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as MediaQueryList;

/**
 * Stubs the browser color-scheme media query for theme resolution tests.
 * @param matches Whether the media query should report dark mode.
 */
const stubColorSchemeMediaQuery = (matches: boolean): void => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => createMediaQueryList(matches)),
  );
};

describe('resolveSyntaxHighlightTheme', () => {
  afterEach(() => {
    document.documentElement.className = '';
    vi.unstubAllGlobals();
  });

  test('uses the explicit dark document class before system preference', () => {
    document.documentElement.classList.add('dark');
    stubColorSchemeMediaQuery(false);

    expect(resolveSyntaxHighlightTheme()).toBe('dark');
  });

  test('uses the explicit light document class before system preference', () => {
    document.documentElement.classList.add('light');
    stubColorSchemeMediaQuery(true);

    expect(resolveSyntaxHighlightTheme()).toBe('light');
  });

  test('uses the system dark preference when no document theme class exists', () => {
    stubColorSchemeMediaQuery(true);

    expect(resolveSyntaxHighlightTheme()).toBe('dark');
  });

  test('defaults to light when no browser media query is available', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(resolveSyntaxHighlightTheme()).toBe('light');
  });
});

const ThemeProbe = () => createElement('output', null, useResolvedSyntaxHighlightTheme());

test('system theme subscriptions work when optional DOM observation is unavailable', () => {
  vi.stubGlobal('MutationObserver', undefined);
  vi.stubGlobal('matchMedia', undefined);
  try {
    const view = render(createElement(ThemeProbe));
    expect(view.container.textContent).toBe('light');
  } finally {
    cleanup();
    vi.unstubAllGlobals();
  }
});
