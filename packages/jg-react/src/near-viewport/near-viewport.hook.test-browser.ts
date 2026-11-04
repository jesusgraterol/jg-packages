import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useNearViewport } from './near-viewport.hook.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  document.body.replaceChildren();
  window.scrollTo({ top: 0, behavior: 'instant' });
  vi.unstubAllGlobals();
});

/**
 * Adds a block a distance below the viewport's bottom edge.
 * @param distance The distance, in pixels.
 * @returns The block.
 */
const addBlockBelow = (distance: number): HTMLDivElement => {
  const spacer = document.createElement('div');
  spacer.style.height = `${String(window.innerHeight + distance)}px`;
  const block = document.createElement('div');
  block.style.height = '10px';
  document.body.append(spacer, block);
  return block;
};

describe('useNearViewport', { tags: ['full'] }, () => {
  /*
   * Vitest runs the page in an iframe, which clips what lies past its edges whatever the margin,
   * so this follows an element in and out of view and checks the margin each observer gets.
   */
  test('follows an element into and out of view, observing with the margin it is given', async () => {
    const margins: (string | undefined)[] = [];
    const RealIntersectionObserver = IntersectionObserver;
    vi.stubGlobal(
      'IntersectionObserver',
      class extends RealIntersectionObserver {
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          super(callback, options);
          margins.push(options?.rootMargin);
        }
      },
    );
    const block = addBlockBelow(2_000);
    const { result, rerender } = renderHook(
      ({ rootMargin }: { rootMargin: string }) => useNearViewport({ rootMargin }),
      { initialProps: { rootMargin: '0px 0px 512px 0px' } },
    );
    act(() => {
      result.current.ref(block);
    });

    block.scrollIntoView({ block: 'center', behavior: 'instant' });
    await vi.waitFor(() => {
      expect(result.current.isNear).toBe(true);
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
    await vi.waitFor(() => {
      expect(result.current.isNear).toBe(false);
    });

    rerender({ rootMargin: '0px 0px 64px 0px' });
    expect(margins).toStrictEqual(['0px 0px 512px 0px', '0px 0px 64px 0px']);
    act(() => {
      result.current.ref(null);
    });
    expect(result.current.isNear).toBe(false);
  });

  test('reads an element in view as near with the default margin, and a detached one as not near', async () => {
    const block = document.createElement('div');
    block.style.height = '10px';
    document.body.append(block);
    const { result } = renderHook(() => useNearViewport());
    act(() => {
      result.current.ref(block);
    });
    await vi.waitFor(() => {
      expect(result.current.isNear).toBe(true);
    });

    act(() => {
      result.current.ref(null);
    });

    expect(result.current.isNear).toBe(false);
  });

  test("reads an element as not near where there's no IntersectionObserver", () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const block = document.createElement('div');
    document.body.append(block);
    const { result } = renderHook(() => useNearViewport());

    act(() => {
      result.current.ref(block);
    });

    expect(result.current.isNear).toBe(false);
  });
});
