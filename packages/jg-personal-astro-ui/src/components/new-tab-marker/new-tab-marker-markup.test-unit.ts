import { describe, expect, test } from 'vitest';

import { NEW_TAB_NOTICE, renderNewTabMarker } from './new-tab-marker-markup.ts';

describe('renderNewTabMarker', () => {
  test('renders the arrow, marked with its hook, and the notice', { tags: ['full'] }, () => {
    const markup = renderNewTabMarker();

    expect(markup).toMatch(/^<svg [^>]*aria-hidden="true"[^>]*data-new-tab-marker>/u);
    expect(markup).toContain('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>');
    expect(markup.endsWith('<span class="sr-only"> (opens in a new tab)</span>')).toBe(true);
  });

  test('keeps the notice without the arrow', { tags: ['full'] }, () => {
    expect(renderNewTabMarker({ icon: false })).toBe(
      `<span class="sr-only">${NEW_TAB_NOTICE}</span>`,
    );
  });

  test('holds nothing a browser could run or fetch', () => {
    const markup = renderNewTabMarker();

    expect(markup).not.toMatch(/\son[a-z]+=|href|src=|url\(|<script|<style/iu);
  });
});
