import { act, cleanup, renderHook } from '@testing-library/react';
import { expectToThrowCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { ERRORS } from '../shared/index.js';
import { useActiveHeading } from './active-heading.hook.js';
import type { IUseActiveHeadingOptions } from './types.js';

const HEADING_IDS = ['first', 'second', 'third'];

// the page these tests scroll: each heading after a tall block of text
let article: HTMLElement;

/*
 * The URL before each test, restored whole after a test that changed it, because Vitest's browser
 * runner keeps the session it reconnects with in the query string. Only a changed URL is restored:
 * WebKit throws a SecurityError on the 101st History API call within 10 seconds, and a restore
 * after every test used up that budget under --repeats.
 */
let originalUrl: string;

beforeEach(async () => {
  await page.viewport(800, 600);
  article = document.createElement('article');
  for (const id of HEADING_IDS) {
    const block = document.createElement('div');
    block.style.height = '1000px';
    const title = document.createElement('h2');
    title.id = id;
    title.textContent = id;
    article.append(block, title);
  }
  const tail = document.createElement('div');
  tail.style.height = '2000px';
  article.append(tail);
  document.body.append(article);
  originalUrl = window.location.href;
});

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  window.scrollTo(0, 0);
  article.remove();
  if (window.location.href !== originalUrl) {
    window.history.replaceState(null, '', originalUrl);
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Renders the hook with its options as props, so a test can change them.
 * @param options The hook's options.
 * @returns The rendered hook.
 */
const renderActiveHeading = (options: IUseActiveHeadingOptions) =>
  renderHook((props: IUseActiveHeadingOptions) => useActiveHeading(props), {
    initialProps: options,
  });

/**
 * Scrolls a heading to a distance from the viewport's top.
 * @param id The heading's id.
 * @param top The distance, in pixels.
 */
const scrollHeadingTo = async (id: string, top: number): Promise<void> => {
  await act(async () => {
    const element = document.getElementById(id) as HTMLElement;
    window.scrollBy(0, element.getBoundingClientRect().top - top);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
};

describe('useActiveHeading', () => {
  test('follows the scroll: the last heading past the offset, or the first before any', async () => {
    const { result } = renderActiveHeading({ headingIds: HEADING_IDS, topOffsetPx: 80 });
    await vi.waitFor(() => {
      expect(result.current.activeHeadingId).toBe('first');
    });

    await scrollHeadingTo('second', 70);
    await vi.waitFor(() => {
      expect(result.current.activeHeadingId).toBe('second');
    });

    await scrollHeadingTo('third', 60);
    await vi.waitFor(() => {
      expect(result.current.activeHeadingId).toBe('third');
    });

    await scrollHeadingTo('first', 400);
    await vi.waitFor(() => {
      expect(result.current.activeHeadingId).toBe('first');
    });
  });

  test("follows the URL's hash on mount and on hashchange, ignoring other ids", () => {
    // without an observer, only the hash moves the active heading
    vi.stubGlobal('IntersectionObserver', undefined);
    window.history.replaceState(null, '', '#second');
    const { result } = renderActiveHeading({ headingIds: HEADING_IDS, topOffsetPx: 80 });
    expect(result.current.activeHeadingId).toBe('second');

    for (const [hash, expected] of [
      ['#third', 'third'],
      ['#missing', 'third'],
      ['#%E0%A4%A', 'third'],
    ] as const) {
      act(() => {
        window.history.replaceState(null, '', hash);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      expect(result.current.activeHeadingId).toBe(expected);
    }
  });

  test('lets the caller set the active heading, with a setter that keeps its identity', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { result, rerender } = renderActiveHeading({ headingIds: HEADING_IDS, topOffsetPx: 80 });
    const { setActiveHeadingId } = result.current;

    act(() => {
      result.current.setActiveHeadingId('third');
    });
    rerender({ headingIds: HEADING_IDS, topOffsetPx: 80 });

    expect(result.current.activeHeadingId).toBe('third');
    expect(result.current.setActiveHeadingId).toBe(setActiveHeadingId);
  });

  test('keeps its observer for a new array with the same ids, and replaces it for other ids', () => {
    const disconnect = vi.spyOn(IntersectionObserver.prototype, 'disconnect');
    const { rerender, unmount } = renderActiveHeading({ headingIds: HEADING_IDS, topOffsetPx: 80 });

    rerender({ headingIds: [...HEADING_IDS], topOffsetPx: 80 });
    expect(disconnect).not.toHaveBeenCalled();

    rerender({ headingIds: ['first', 'missing'], topOffsetPx: 80 });
    expect(disconnect).toHaveBeenCalledTimes(1);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  test('observes nothing without headings', () => {
    const observe = vi.spyOn(IntersectionObserver.prototype, 'observe');

    const { result } = renderActiveHeading({ headingIds: [], topOffsetPx: 80 });

    expect(observe).not.toHaveBeenCalled();
    expect(result.current.activeHeadingId).toBeNull();
  });

  test.each([[-1], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'refuses a top offset of %d with INVALID_ACTIVE_HEADING_OFFSET',
    (topOffsetPx) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expectToThrowCode(
        () => renderActiveHeading({ headingIds: HEADING_IDS, topOffsetPx }),
        ERRORS.INVALID_ACTIVE_HEADING_OFFSET,
        "The active heading's top offset must be a finite number of pixels of at least 0.",
      );
    },
  );
});
