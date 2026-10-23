import { describe, expect, test } from 'vitest';

import { lockDialogScroll } from './dialog-scroll.ts';
import { createDialogFixture } from './dialog.test-utils.ts';

describe('lockDialogScroll', () => {
  test('restores exact owned values and priorities, preserves unrelated changes, and restores position once', () => {
    const fixture = createDialogFixture();
    fixture.body.setAttribute('style', 'existing');
    fixture.body.style.setProperty('position', 'relative', 'important');
    fixture.body.style.setProperty('padding-right', '12px');
    fixture.html.style.setProperty('scroll-behavior', 'smooth');
    const release = lockDialogScroll(fixture.document);
    expect(fixture.body.style.getPropertyValue('position')).toBe('fixed');
    expect(fixture.body.style.getPropertyValue('top')).toBe('-256px');
    expect(fixture.body.style.getPropertyValue('left')).toBe('-8px');
    expect(fixture.body.style.getPropertyValue('padding-right')).toBe('calc(12px + 16px)');
    const releaseSecond = lockDialogScroll(fixture.document);
    fixture.body.style.setProperty('color', 'red');
    release();
    release();
    expect(fixture.view.scrollTo).not.toHaveBeenCalled();
    releaseSecond();
    expect(fixture.body.style.getPropertyValue('position')).toBe('relative');
    expect(fixture.body.style.getPropertyPriority('position')).toBe('important');
    expect(fixture.body.style.getPropertyValue('padding-right')).toBe('12px');
    expect(fixture.body.style.getPropertyValue('color')).toBe('red');
    expect(fixture.html.style.getPropertyValue('scroll-behavior')).toBe('smooth');
    expect(fixture.view.scrollTo).toHaveBeenCalledExactlyOnceWith({
      left: 8,
      top: 256,
      behavior: 'instant',
    });
    releaseSecond();
    expect(fixture.view.scrollTo).toHaveBeenCalledOnce();
    const next = lockDialogScroll(fixture.document);
    next();
    expect(fixture.view.scrollTo).toHaveBeenCalledTimes(2);
  });

  test('does not add scrollbar compensation for overlay scrollbars and preserves an originally empty style attribute', () => {
    const fixture = createDialogFixture();
    fixture.view.innerWidth = fixture.html.clientWidth;
    fixture.body.setAttribute('style', '');
    const release = lockDialogScroll(fixture.document);
    expect(fixture.body.style.getPropertyValue('padding-right')).toBe('');
    release();
    expect(fixture.body.hasAttribute('style')).toBe(true);
    expect(fixture.html.hasAttribute('style')).toBe(false);
    expect(fixture.body.style.length).toBe(0);
  });

  test('supports documents without a browsing context', () => {
    const fixture = createDialogFixture();
    fixture.root.defaultView = null;
    expect(() => lockDialogScroll(fixture.document)()).not.toThrow();
    expect(fixture.body.style.length).toBe(0);
  });
});
