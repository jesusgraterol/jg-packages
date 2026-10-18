import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { useBreakpoint } from './breakpoint/index.js';
import { useDocumentVisibility } from './document-visibility/index.js';
import { useFormChanges } from './form-changes/index.js';
import { useOnlineStatus } from './online-status/index.js';
import { type IUseResendCooldownOptions, useResendCooldown } from './resend-cooldown/index.js';
import { useIsWindowScrolledPast } from './window-scroll/index.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Overrides a read-only property of an object for one test, such as navigator.onLine.
 * @param target The object.
 * @param property The property.
 * @param read Reads the property's value.
 * @returns The function that restores the original property.
 */
const overrideGetter = (target: object, property: string, read: () => unknown): (() => void) => {
  Object.defineProperty(target, property, { configurable: true, get: read });
  return () => {
    Reflect.deleteProperty(target, property);
  };
};

describe('useOnlineStatus', () => {
  test('follows the browser going offline and back online', () => {
    let onLine = true;
    const restore = overrideGetter(navigator, 'onLine', () => onLine);
    try {
      const { result } = renderHook(() => useOnlineStatus());
      expect(result.current).toBe(true);

      act(() => {
        onLine = false;
        window.dispatchEvent(new Event('offline'));
      });
      expect(result.current).toBe(false);

      act(() => {
        onLine = true;
        window.dispatchEvent(new Event('online'));
      });
      expect(result.current).toBe(true);
    } finally {
      restore();
    }
  });
});

describe('useDocumentVisibility', () => {
  test('keeps one subscription across renders, follows changes, and releases it on unmount', () => {
    let visibilityState: DocumentVisibilityState = 'visible';
    const restore = overrideGetter(document, 'visibilityState', () => visibilityState);
    const addListener = vi.spyOn(document, 'addEventListener');
    const removeListener = vi.spyOn(document, 'removeEventListener');
    const countVisibility = (spy: typeof addListener): number =>
      spy.mock.calls.filter(([name]) => name === 'visibilitychange').length;
    try {
      const { result, rerender, unmount } = renderHook(() => useDocumentVisibility());
      expect(result.current).toBe(true);
      rerender();
      expect(countVisibility(addListener)).toBe(1);

      act(() => {
        visibilityState = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current).toBe(false);

      unmount();
      expect(countVisibility(removeListener)).toBe(1);
    } finally {
      restore();
    }
  });

  test('renders visible on the server even when the host page is hidden', () => {
    const restore = overrideGetter(document, 'visibilityState', () => 'hidden');
    try {
      const Probe = () =>
        createElement('span', null, useDocumentVisibility() ? 'visible' : 'hidden');

      expect(renderToString(createElement(Probe))).toBe('<span>visible</span>');
    } finally {
      restore();
    }
  });
});

describe('useBreakpoint', () => {
  test('reads xs on a phone, follows resizes across breakpoints, and only re-renders on a crossing', async () => {
    await page.viewport(375, 800);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useBreakpoint();
    });
    expect(result.current).toBe('xs');

    await page.viewport(390, 800);
    await page.viewport(700, 800);
    await vi.waitFor(() => {
      expect(result.current).toBe('sm');
    });
    const rendersAtSm = renders;

    await page.viewport(720, 800);
    await page.viewport(1300, 800);
    await vi.waitFor(() => {
      expect(result.current).toBe('xl');
    });
    expect(renders).toBe(rendersAtSm + 1);
  });
});

describe('useIsWindowScrolledPast', () => {
  test('turns true past the threshold, and re-renders only when the answer changes', async () => {
    await page.viewport(800, 600);
    const spacer = document.createElement('div');
    spacer.style.height = '5000px';
    document.body.append(spacer);
    try {
      let renders = 0;
      const { result } = renderHook(() => {
        renders += 1;
        return useIsWindowScrolledPast(100);
      });
      expect(result.current).toBe(false);
      const initialRenders = renders;

      const scrollTo = async (top: number): Promise<void> => {
        await act(async () => {
          window.scrollTo(0, top);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        });
      };
      await scrollTo(50);
      expect(result.current).toBe(false);
      expect(renders).toBe(initialRenders);

      await scrollTo(200);
      await vi.waitFor(() => {
        expect(result.current).toBe(true);
      });
      const rendersPastThreshold = renders;

      await scrollTo(400);
      await scrollTo(900);
      expect(result.current).toBe(true);
      expect(renders).toBe(rendersPastThreshold);
    } finally {
      window.scrollTo(0, 0);
      spacer.remove();
    }
  });
});

describe('useFormChanges', () => {
  type IProfile = { name: string; bio: string };

  const trimProfile = ({ name, bio }: IProfile): IProfile => ({
    name: name.trim(),
    bio: bio.trim(),
  });

  const saved: IProfile = { name: 'Ada', bio: 'Mathematician' };

  test('counts a whitespace-only edit as unchanged, and a real edit as changed', () => {
    const { result, rerender } = renderHook(
      ({ current }: { current: IProfile }) =>
        useFormChanges({
          confirmedCommand: saved,
          currentCommand: current,
          normalizeCommand: trimProfile,
        }),
      { initialProps: { current: saved } },
    );
    expect(result.current.hasChanges).toBe(false);

    rerender({ current: { name: ' Ada ', bio: 'Mathematician  ' } });
    expect(result.current.hasChanges).toBe(false);

    rerender({ current: { name: 'Ada Lovelace', bio: 'Mathematician' } });
    expect(result.current.hasChanges).toBe(true);
    expect(result.current.guardSubmission({ name: 'Ada', bio: 'Mathematician' })).toBe(false);
    expect(result.current.guardSubmission({ name: 'Ada Lovelace', bio: 'Mathematician' })).toBe(
      true,
    );
  });

  test('advances the baseline once a save is confirmed, and keeps it when the parent rebuilds the same command', () => {
    const edited: IProfile = { name: 'Ada Lovelace', bio: 'Mathematician' };
    const { result, rerender } = renderHook(
      ({ confirmed }: { confirmed: IProfile }) =>
        useFormChanges({ confirmedCommand: confirmed, currentCommand: edited }),
      { initialProps: { confirmed: saved } },
    );
    expect(result.current.hasChanges).toBe(true);

    act(() => {
      result.current.confirmChanges(edited);
    });
    expect(result.current.hasChanges).toBe(false);

    rerender({ confirmed: { ...saved } });
    expect(result.current.hasChanges).toBe(false);
  });

  test('advances the baseline when the confirmed command changes by value', () => {
    const edited: IProfile = { name: 'Ada Lovelace', bio: 'Mathematician' };
    const { result, rerender } = renderHook(
      ({ confirmed }: { confirmed: IProfile }) =>
        useFormChanges({ confirmedCommand: confirmed, currentCommand: edited }),
      { initialProps: { confirmed: saved } },
    );
    expect(result.current.hasChanges).toBe(true);

    rerender({ confirmed: { ...edited } });
    expect(result.current.hasChanges).toBe(false);
  });
});

describe('useResendCooldown', () => {
  const NOW = 1_800_000_000_000;
  let storeCount = 0;

  /**
   * Gives a test a store id of its own, so deadlines and storage failures stay in that test.
   * @returns The store id.
   */
  const createStoreId = (): string => {
    storeCount += 1;
    return `resend-test-${String(storeCount)}`;
  };

  /**
   * Renders the hook with fake timers set to NOW.
   * @param options The hook's options.
   * @returns The rendered hook.
   */
  const renderCooldown = (options: IUseResendCooldownOptions) =>
    renderHook((props: IUseResendCooldownOptions) => useResendCooldown(props), {
      initialProps: options,
    });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('starts only on startCooldown, counts down, and unlocks at the boundary', () => {
    vi.useFakeTimers({ now: NOW });
    const { result } = renderCooldown({ durationSeconds: 60, storeId: createStoreId() });
    expect(result.current).toMatchObject({ isCoolingDown: false, remainingSeconds: 0 });

    act(() => {
      result.current.startCooldown();
    });
    expect(result.current).toMatchObject({ isCoolingDown: true, remainingSeconds: 60 });

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(result.current.remainingSeconds).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toMatchObject({ isCoolingDown: false, remainingSeconds: 0 });
  });

  test('restores the deadline from sessionStorage after a remount', () => {
    vi.useFakeTimers({ now: NOW });
    const options = {
      durationSeconds: 60,
      cooldownKey: 'account-a:verify',
      storeId: createStoreId(),
    };
    const first = renderCooldown(options);
    act(() => {
      first.result.current.startCooldown();
    });
    first.unmount();
    expect(sessionStorage.getItem(`jg-storage:${options.storeId}:account-a:verify`)).toBe(
      String(NOW + 60_000),
    );

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    const second = renderCooldown(options);

    expect(second.result.current).toMatchObject({ isCoolingDown: true, remainingSeconds: 40 });
  });

  test("keeps each key's deadline apart", () => {
    vi.useFakeTimers({ now: NOW });
    const storeId = createStoreId();
    const { result, rerender } = renderCooldown({
      durationSeconds: 60,
      cooldownKey: 'account-a:verify',
      storeId,
    });
    act(() => {
      result.current.startCooldown();
    });

    rerender({ durationSeconds: 60, cooldownKey: 'account-b:verify', storeId });
    expect(result.current.isCoolingDown).toBe(false);

    rerender({ durationSeconds: 60, cooldownKey: 'account-a:verify', storeId });
    expect(result.current.isCoolingDown).toBe(true);
  });

  test("uses the server's last send only until the tab sends itself", () => {
    vi.useFakeTimers({ now: NOW });
    const storeId = createStoreId();
    const { result, rerender } = renderCooldown({
      durationSeconds: 60,
      cooldownKey: 'account-a:invite',
      lastAttemptedAt: new Date(NOW - 30_000).toISOString(),
      storeId,
    });
    expect(result.current.remainingSeconds).toBe(30);

    act(() => {
      result.current.startCooldown();
    });
    expect(result.current.remainingSeconds).toBe(60);

    rerender({
      durationSeconds: 60,
      cooldownKey: 'account-a:invite',
      lastAttemptedAt: new Date(NOW - 50_000).toISOString(),
      storeId,
    });
    expect(result.current.remainingSeconds).toBe(60);
  });

  test('caps a server send in the future at one full duration', () => {
    vi.useFakeTimers({ now: NOW });
    const { result } = renderCooldown({
      durationSeconds: 60,
      lastAttemptedAt: NOW + 300_000,
      storeId: createStoreId(),
    });
    expect(result.current.remainingSeconds).toBe(60);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.isCoolingDown).toBe(false);
  });

  test('reads the time again when a hidden tab is shown', () => {
    vi.useFakeTimers({ now: NOW });
    const { result } = renderCooldown({ durationSeconds: 60, storeId: createStoreId() });
    act(() => {
      result.current.startCooldown();
    });

    act(() => {
      vi.setSystemTime(NOW + 60_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isCoolingDown).toBe(false);
  });

  test('ignores a stored value that is not JSON, and removes it', () => {
    vi.useFakeTimers({ now: NOW });
    const storeId = createStoreId();
    sessionStorage.setItem(`jg-storage:${storeId}:account-a:verify`, '{malformed');

    const { result } = renderCooldown({
      durationSeconds: 60,
      cooldownKey: 'account-a:verify',
      storeId,
    });

    expect(result.current.isCoolingDown).toBe(false);
    expect(sessionStorage.getItem(`jg-storage:${storeId}:account-a:verify`)).toBeNull();
  });

  test('keeps the deadline in memory when sessionStorage starts refusing writes', () => {
    vi.useFakeTimers({ now: NOW });
    const options = {
      durationSeconds: 60,
      cooldownKey: 'account-a:verify',
      storeId: createStoreId(),
    };
    const first = renderCooldown(options);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is unavailable', 'SecurityError');
    });

    act(() => {
      first.result.current.startCooldown();
    });
    expect(first.result.current.isCoolingDown).toBe(true);
    first.unmount();

    const second = renderCooldown(options);
    expect(second.result.current).toMatchObject({ isCoolingDown: true, remainingSeconds: 60 });
  });

  test('hydrates without a mismatch, before and after the deadline, then shows the right state', () => {
    vi.useFakeTimers({ now: NOW });
    const lastAttemptedAt = NOW - 10_000;
    const Probe = (props: IUseResendCooldownOptions) => {
      const { isCoolingDown, remainingSeconds } = useResendCooldown(props);
      return createElement(
        'p',
        null,
        isCoolingDown ? `Resend in ${String(remainingSeconds)}s` : 'Resend',
      );
    };

    /**
     * Hydrates the server's HTML for the probe now, and reports recoverable errors.
     * @param html The server's HTML.
     * @param props The probe's props.
     * @returns The container's text after hydration, and the recoverable errors.
     */
    const hydrate = (html: string, props: IUseResendCooldownOptions) => {
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.append(container);
      const onRecoverableError = vi.fn();
      let root: Root | undefined;
      act(() => {
        root = hydrateRoot(container, createElement(Probe, props), { onRecoverableError });
      });
      const text = container.textContent;
      act(() => {
        root?.unmount();
      });
      container.remove();
      return { text, onRecoverableError };
    };

    const props = { durationSeconds: 60, lastAttemptedAt, storeId: createStoreId() };
    const html = renderToString(createElement(Probe, props));
    expect(html).toBe('<p>Resend</p>');

    const beforeDeadline = hydrate(html, props);
    expect(beforeDeadline.onRecoverableError).not.toHaveBeenCalled();
    expect(beforeDeadline.text).toBe('Resend in 50s');

    vi.setSystemTime(NOW + 70_000);
    const afterDeadline = hydrate(html, props);
    expect(afterDeadline.onRecoverableError).not.toHaveBeenCalled();
    expect(afterDeadline.text).toBe('Resend');
  });
});
