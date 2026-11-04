import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useIsTextClamped } from './text-clamp.hook.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

// a sentence long enough to wrap onto several lines in a 200px box
const LONG_TEXT = 'A message long enough to wrap onto many lines in a narrow box. '.repeat(6);

/**
 * Adds a box of text clamped to 3 lines, or shown in full.
 * @param text The text.
 * @param isExpanded Whether the box shows the text in full.
 * @returns The box.
 */
const addTextBox = (text: string, isExpanded = false): HTMLParagraphElement => {
  const box = document.createElement('p');
  box.style.width = '200px';
  box.style.font = '16px/20px sans-serif';
  box.style.margin = '0';
  if (!isExpanded) {
    box.style.display = '-webkit-box';
    box.style.webkitBoxOrient = 'vertical';
    box.style.webkitLineClamp = '3';
    box.style.overflow = 'hidden';
  }
  box.textContent = text;
  document.body.append(box);
  return box;
};

describe('useIsTextClamped', { tags: ['full'] }, () => {
  test('tells text the clamp cuts off, whether it shows clamped or in full', () => {
    const clamped = addTextBox(LONG_TEXT);
    const expanded = addTextBox(LONG_TEXT, true);
    const short = addTextBox('Short.');
    const { result } = renderHook(() => useIsTextClamped({ lines: 3 }));

    act(() => {
      result.current.ref(clamped);
    });
    expect(result.current.isClamped).toBe(true);
    act(() => {
      result.current.ref(expanded);
    });
    expect(result.current.isClamped).toBe(true);
    act(() => {
      result.current.ref(short);
    });
    expect(result.current.isClamped).toBe(false);
    act(() => {
      result.current.ref(null);
    });
    expect(result.current.isClamped).toBe(false);
  });

  test('measures new content as it renders, and again when the box resizes', async () => {
    const box = addTextBox('Short.');
    const { result, rerender } = renderHook(
      ({ content }: { content: string }) => useIsTextClamped({ lines: 3, content }),
      { initialProps: { content: 'Short.' } },
    );
    act(() => {
      result.current.ref(box);
    });
    expect(result.current.isClamped).toBe(false);

    box.textContent = LONG_TEXT;
    rerender({ content: LONG_TEXT });
    expect(result.current.isClamped).toBe(true);

    box.style.width = '4000px';
    await vi.waitFor(() => {
      expect(result.current.isClamped).toBe(false);
    });
  });

  test("reads the font's size when the line height is normal", () => {
    const box = addTextBox(LONG_TEXT);
    box.style.lineHeight = 'normal';
    const { result } = renderHook(() => useIsTextClamped({ lines: 3 }));

    act(() => {
      result.current.ref(box);
    });

    expect(result.current.isClamped).toBe(true);
  });

  test("measures once where there's no ResizeObserver", () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const box = addTextBox(LONG_TEXT);
    const { result } = renderHook(() => useIsTextClamped({ lines: 3 }));

    act(() => {
      result.current.ref(box);
    });

    expect(result.current.isClamped).toBe(true);
  });
});
