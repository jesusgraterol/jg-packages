// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import { resolveFinalFocus } from './index.js';

describe('resolveFinalFocus', () => {
  test('preserves explicit focus behavior without invoking the close handler', () => {
    const onCloseAutoFocus = vi.fn();

    expect(resolveFinalFocus(false, onCloseAutoFocus)).toBe(false);
    expect(resolveFinalFocus(undefined)).toBeUndefined();
    expect(onCloseAutoFocus).not.toHaveBeenCalled();
  });

  test('allows default focus when the close event is not canceled', () => {
    const onCloseAutoFocus = vi.fn<(event: Event) => void>();
    const finalFocus = resolveFinalFocus(undefined, onCloseAutoFocus);

    expect(typeof finalFocus).toBe('function');
    if (typeof finalFocus !== 'function') {
      return;
    }

    expect(finalFocus('keyboard')).toBe(true);
    expect(onCloseAutoFocus).toHaveBeenCalledOnce();
    expect(onCloseAutoFocus.mock.calls[0]?.[0].type).toBe('closeAutoFocus');
  });

  test('prevents default focus when the close event is canceled', () => {
    const finalFocus = resolveFinalFocus(undefined, (event) => event.preventDefault());

    expect(typeof finalFocus).toBe('function');
    if (typeof finalFocus !== 'function') {
      return;
    }

    expect(finalFocus('keyboard')).toBe(false);
  });
});
