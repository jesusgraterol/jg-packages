import { afterEach, describe, expect, test, vi } from 'vitest';

import { preserveDocumentWidthWithoutScrollbarGutter } from './utilities.js';

describe('drawer scrollbar gutter utilities', () => {
  afterEach(() => {
    document.documentElement.classList.remove('app-ui-right-drawer-scroll-lock');
    document.documentElement.style.cssText = '';
    document.body.style.cssText = '';
    vi.restoreAllMocks();
  });

  test('overrides the desktop gutter without replacing Base UI scroll-lock styles', async () => {
    const viewportElement = document.createElement('div');

    document.body.appendChild(viewportElement);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1016);

    const restoreDocument = preserveDocumentWidthWithoutScrollbarGutter(viewportElement);

    expect(document.documentElement.style.scrollbarGutter).toBe('');

    document.documentElement.style.scrollbarGutter = 'stable';
    document.documentElement.style.overflowY = 'hidden';
    await Promise.resolve();

    expect(document.documentElement.classList).toContain('app-ui-right-drawer-scroll-lock');
    expect(
      document.documentElement.style.getPropertyValue('--app-ui-right-drawer-scrollbar-width'),
    ).toBe('16px');
    expect(document.documentElement.style.overflowY).toBe('hidden');
    expect(document.documentElement.style.scrollbarGutter).toBe('stable');
    expect(document.body.style.width).toBe('');

    restoreDocument();

    expect(document.documentElement.classList).not.toContain('app-ui-right-drawer-scroll-lock');
    expect(
      document.documentElement.style.getPropertyValue('--app-ui-right-drawer-scrollbar-width'),
    ).toBe('');
    expect(document.documentElement.style.overflowY).toBe('hidden');
    expect(document.documentElement.style.scrollbarGutter).toBe('stable');
    expect(document.body.style.width).toBe('');

    viewportElement.remove();
  });

  test('leaves overlay-scrollbar documents unchanged', () => {
    const viewportElement = document.createElement('div');

    document.body.appendChild(viewportElement);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1016);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1016);

    const restoreDocument = preserveDocumentWidthWithoutScrollbarGutter(viewportElement);

    expect(document.documentElement.style.cssText).toBe('');
    expect(document.body.style.cssText).toBe('');

    restoreDocument();
    viewportElement.remove();
  });

  test('retains the adjustment until every right drawer releases it', async () => {
    const firstViewportElement = document.createElement('div');
    const secondViewportElement = document.createElement('div');

    document.body.append(firstViewportElement, secondViewportElement);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1016);

    const restoreFirstDocument = preserveDocumentWidthWithoutScrollbarGutter(firstViewportElement);
    const restoreSecondDocument =
      preserveDocumentWidthWithoutScrollbarGutter(secondViewportElement);

    document.documentElement.style.scrollbarGutter = 'stable';
    await Promise.resolve();

    restoreFirstDocument();

    expect(document.documentElement.classList).toContain('app-ui-right-drawer-scroll-lock');

    restoreSecondDocument();

    expect(document.documentElement.classList).not.toContain('app-ui-right-drawer-scroll-lock');

    firstViewportElement.remove();
    secondViewportElement.remove();
  });

  test('restores pre-existing adjustment hooks and their CSS priority', () => {
    const viewport = document.createElement('div');
    document.body.append(viewport);
    document.documentElement.classList.add('app-ui-right-drawer-scroll-lock');
    document.documentElement.style.setProperty(
      '--app-ui-right-drawer-scrollbar-width',
      '12px',
      'important',
    );
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1016);
    document.documentElement.setAttribute('data-base-ui-scroll-locked', '');
    const restore = preserveDocumentWidthWithoutScrollbarGutter(viewport);
    try {
      expect(
        document.documentElement.style.getPropertyValue('--app-ui-right-drawer-scrollbar-width'),
      ).toBe('16px');
    } finally {
      restore();
      document.documentElement.removeAttribute('data-base-ui-scroll-locked');
      viewport.remove();
    }
    expect(document.documentElement.classList.contains('app-ui-right-drawer-scroll-lock')).toBe(
      true,
    );
    expect(
      document.documentElement.style.getPropertyValue('--app-ui-right-drawer-scrollbar-width'),
    ).toBe('12px');
    expect(
      document.documentElement.style.getPropertyPriority('--app-ui-right-drawer-scrollbar-width'),
    ).toBe('important');
  });

  test('detached documents without a window do not acquire gutter ownership', () => {
    const detached = document.implementation.createHTMLDocument('Detached document');
    const viewport = detached.createElement('div');
    const restore = preserveDocumentWidthWithoutScrollbarGutter(viewport);
    restore();
    expect(detached.documentElement.style.cssText).toBe('');
  });

  test('a late observer boundary callback cannot reapply a released adjustment', () => {
    let notify: MutationCallback | undefined;
    const observer = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(() => []),
    } satisfies MutationObserver;
    class LateMutationObserver {
      public constructor(callback: MutationCallback) {
        notify = callback;
        return observer;
      }
    }
    vi.stubGlobal('MutationObserver', LateMutationObserver);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1016);
    const viewport = document.createElement('div');
    const restore = preserveDocumentWidthWithoutScrollbarGutter(viewport);
    restore();
    notify?.([], observer);
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(document.documentElement.classList.contains('app-ui-right-drawer-scroll-lock')).toBe(
      false,
    );
    expect(
      document.documentElement.style.getPropertyValue('--app-ui-right-drawer-scrollbar-width'),
    ).toBe('');
    vi.unstubAllGlobals();
  });
});
