import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useElementWidth } from './element-width.hook.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

/**
 * Adds a block of a given width to the page.
 * @param width The width, in pixels.
 * @returns The block.
 */
const addBlock = (width: number): HTMLDivElement => {
  const block = document.createElement('div');
  block.style.width = `${String(width)}px`;
  block.style.height = '10px';
  document.body.append(block);
  return block;
};

/**
 * Waits long enough for a ResizeObserver's callback to run.
 * @returns A promise that resolves after two frames.
 */
const settle = async (): Promise<void> => {
  for (let frame = 0; frame < 2; frame += 1) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }
};

// the layout a width calls for, so only crossing 600 pixels changes it
const toLayout = (width: number): 'narrow' | 'wide' => (width >= 600 ? 'wide' : 'narrow');

/**
 * Renders the hook, counting its renders.
 * @returns The hook's result and the count so far.
 */
const renderWidthHook = () => {
  const counter = { renders: 0 };
  const hook = renderHook(() => {
    counter.renders += 1;
    return useElementWidth(toLayout);
  });
  return { ...hook, counter };
};

describe('useElementWidth', () => {
  test('measures an attached element at once, and re-renders only when the value changes', async () => {
    const block = addBlock(300);
    const { result, counter } = renderWidthHook();
    expect(result.current.value).toBeUndefined();

    act(() => {
      result.current.ref(block);
    });
    expect(result.current.value).toBe('narrow');
    const rendersAfterAttach = counter.renders;

    await act(async () => {
      block.style.width = '450px';
      await settle();
    });
    expect(counter.renders).toBe(rendersAfterAttach);

    await act(async () => {
      block.style.width = '700px';
      await settle();
    });
    expect(result.current.value).toBe('wide');
    expect(counter.renders).toBe(rendersAfterAttach + 1);
  });

  test('measures the new element when another is attached, and resets when detached', () => {
    const narrow = addBlock(300);
    const wide = addBlock(800);
    const { result } = renderWidthHook();

    act(() => {
      result.current.ref(narrow);
    });
    expect(result.current.value).toBe('narrow');
    act(() => {
      result.current.ref(wide);
    });
    expect(result.current.value).toBe('wide');
    act(() => {
      result.current.ref(null);
    });
    expect(result.current.value).toBeUndefined();
  });

  test('keeps the last value while the element is hidden, which measures 0', async () => {
    const block = addBlock(800);
    const { result } = renderWidthHook();
    act(() => {
      result.current.ref(block);
    });

    await act(async () => {
      block.style.display = 'none';
      await settle();
    });

    expect(result.current.value).toBe('wide');
  });

  test("ignores an element that's hidden when it's attached", () => {
    const block = addBlock(800);
    block.style.display = 'none';
    const { result } = renderWidthHook();

    act(() => {
      result.current.ref(block);
    });

    expect(result.current.value).toBeUndefined();
  });

  test("follows the window's resize event where there's no ResizeObserver", () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const block = addBlock(300);
    const { result, unmount } = renderWidthHook();
    act(() => {
      result.current.ref(block);
    });
    expect(result.current.value).toBe('narrow');

    act(() => {
      block.style.width = '900px';
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.value).toBe('wide');

    // unmounting stops listening
    unmount();
    block.style.width = '300px';
    window.dispatchEvent(new Event('resize'));
  });
});
