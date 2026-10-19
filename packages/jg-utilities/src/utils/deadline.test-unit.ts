// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/errors.js';

import { MAX_TIMEOUT_MS } from './constants.js';
import { createDeadline } from './deadline.js';

const NOW = Date.UTC(2026, 9, 19, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createDeadline', () => {
  test('counts down, expires from its exact millisecond, and aborts with a TimeoutError', () => {
    const deadline = createDeadline({ timeoutSeconds: 10 });

    expect(deadline.deadlineAt).toBe(NOW + 10_000);
    expect(deadline.remainingMs()).toBe(10_000);
    vi.advanceTimersByTime(9_999);
    expect(deadline.isExpired()).toBe(false);
    expect(deadline.stopReason()).toBeNull();
    expect(deadline.signal.aborted).toBe(false);
    expect(() => {
      deadline.throwIfStopped();
    }).not.toThrow();

    vi.advanceTimersByTime(1);

    expect(deadline.remainingMs()).toBe(0);
    expect(deadline.isExpired()).toBe(true);
    expect(deadline.stopReason()).toBe('deadline');
    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.signal.reason).toBeInstanceOf(DOMException);
    expect((deadline.signal.reason as DOMException).name).toBe('TimeoutError');
    expectToThrowCode(
      () => {
        deadline.throwIfStopped();
      },
      ERRORS.DEADLINE_EXCEEDED,
      'The deadline passed before the work finished.',
    );
  });

  test("carries the deadline's time in DEADLINE_EXCEEDED's data", () => {
    const deadline = createDeadline({ timeoutSeconds: 0 });
    let error: unknown;

    try {
      deadline.throwIfStopped();
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({ data: { deadlineAt: new Date(NOW).toISOString() } });
  });

  test.each([
    ['a timeout of 0', { timeoutSeconds: 0 }],
    ['a past time', { deadlineAt: NOW - 1 }],
    ['a past Date', { deadlineAt: new Date(NOW - 60_000) }],
  ])('is expired and aborted at once for %s', (_, options) => {
    const deadline = createDeadline(options);

    expect(deadline.isExpired()).toBe(true);
    expect(deadline.signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  test.each([
    ['the timeout', { timeoutSeconds: 5, deadlineAt: NOW + 60_000 }, NOW + 5_000],
    ['the time', { timeoutSeconds: 60, deadlineAt: new Date(NOW + 5_000) }, NOW + 5_000],
  ])('takes the earlier of both options, here %s', (_, options, expected) => {
    expect(createDeadline(options).deadlineAt).toBe(expected);
  });

  test('sets no timer for a deadline of Infinity, which never expires', () => {
    const deadline = createDeadline({ deadlineAt: Number.POSITIVE_INFINITY });

    expect(vi.getTimerCount()).toBe(0);
    expect(deadline.remainingMs()).toBe(Number.POSITIVE_INFINITY);
    vi.setSystemTime(NOW + 365 * 86_400_000);
    expect(deadline.isExpired()).toBe(false);
    expect(deadline.stopReason()).toBeNull();
  });

  test("gives the caller's signal priority: its reason, and cancelled", () => {
    const controller = new AbortController();
    const deadline = createDeadline({ timeoutSeconds: 5, signal: controller.signal });
    const reason = new Error('the request ended');
    // a consumer listens, as fetch does; without one, Node.js 24.21 and later fill an
    // AbortSignal.any signal's reason in only when it's read, from the first source in its list
    const receivedReasons: unknown[] = [];
    deadline.signal.addEventListener('abort', () => receivedReasons.push(deadline.signal.reason));
    vi.advanceTimersByTime(5_000);

    controller.abort(reason);

    expect(deadline.stopReason()).toBe('cancelled');
    expect(() => {
      deadline.throwIfStopped();
    }).toThrow(reason);
    // the deadline aborted first, so the consumer heard its TimeoutError, once
    expect(receivedReasons).toHaveLength(1);
    expect((receivedReasons[0] as DOMException).name).toBe('TimeoutError');
  });

  test("aborts with the caller's reason when the caller's signal aborts first", () => {
    const controller = new AbortController();
    const deadline = createDeadline({ timeoutSeconds: 5, signal: controller.signal });

    controller.abort(new Error('the request ended'));

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.signal.reason).toStrictEqual(new Error('the request ended'));
    expect(deadline.stopReason()).toBe('cancelled');
  });

  test("is cancelled at once by a caller's signal that's already aborted", () => {
    const controller = new AbortController();
    controller.abort(new Error('gone'));

    const deadline = createDeadline({ timeoutSeconds: 5, signal: controller.signal });

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.stopReason()).toBe('cancelled');
  });

  test('notices a clock jump past the deadline before its timer fires', () => {
    const deadline = createDeadline({ timeoutSeconds: 60 });

    vi.setSystemTime(NOW + 120_000);

    expect(deadline.signal.aborted).toBe(false);
    expect(deadline.isExpired()).toBe(true);
    expect(deadline.stopReason()).toBe('deadline');
    expectToThrowCode(() => {
      deadline.throwIfStopped();
    }, ERRORS.DEADLINE_EXCEEDED);
  });

  test('waits in steps for a deadline further away than setTimeout allows', () => {
    const deadline = createDeadline({ deadlineAt: NOW + MAX_TIMEOUT_MS + 60_000 });

    vi.advanceTimersByTime(MAX_TIMEOUT_MS);
    expect(deadline.signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(60_000);
    expect(deadline.signal.aborted).toBe(true);
  });

  test('leaves no timer after dispose, and never aborts then', () => {
    const controller = new AbortController();
    const deadline = createDeadline({ timeoutSeconds: 5, signal: controller.signal });
    expect(vi.getTimerCount()).toBe(1);

    deadline.dispose();
    deadline.dispose();

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(deadline.signal.aborted).toBe(false);
  });

  test('unrefs its timer where the runtime supports it, and works where setTimeout gives a number', () => {
    const unref = vi.fn();
    const realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout')
      .mockImplementationOnce(((callback: () => void, delay: number) =>
        Object.assign(realSetTimeout(callback, delay), { unref })) as never)
      .mockImplementationOnce(((callback: () => void, delay: number) => {
        realSetTimeout(callback, delay);
        return 1;
      }) as never);

    createDeadline({ timeoutSeconds: 5 });
    const browserLike = createDeadline({ timeoutSeconds: 5 });
    vi.advanceTimersByTime(5_000);

    expect(unref).toHaveBeenCalledOnce();
    expect(browserLike.signal.aborted).toBe(true);
  });

  describe('child', () => {
    test('ends after its own timeout, within the parent', () => {
      const parent = createDeadline({ timeoutSeconds: 60 });

      const child = parent.child({ timeoutSeconds: 10 });

      expect(child.deadlineAt).toBe(NOW + 10_000);
      vi.advanceTimersByTime(10_000);
      expect(child.stopReason()).toBe('deadline');
      expect(parent.stopReason()).toBeNull();
    });

    test("is capped at the parent's deadline, and ends with it", () => {
      const parent = createDeadline({ timeoutSeconds: 5 });

      const child = parent.child({ timeoutSeconds: 60 });

      expect(child.deadlineAt).toBe(parent.deadlineAt);
      vi.advanceTimersByTime(5_000);
      expect(child.stopReason()).toBe('deadline');
      expect(child.signal.aborted).toBe(true);
    });

    test("is cancelled by the caller's signal", () => {
      const controller = new AbortController();
      const child = createDeadline({ timeoutSeconds: 60, signal: controller.signal }).child({
        timeoutSeconds: 10,
      });

      controller.abort(new Error('the request ended'));

      expect(child.stopReason()).toBe('cancelled');
      expect(child.signal.aborted).toBe(true);
    });

    test('refuses a timeout that is not valid', () => {
      expectToThrowCode(
        () => createDeadline({ timeoutSeconds: 5 }).child({ timeoutSeconds: -1 }),
        ERRORS.INVALID_DEADLINE,
      );
    });
  });

  test.each<[string, Record<string, unknown>]>([
    ['neither a timeout nor a time', {}],
    ['a negative timeout', { timeoutSeconds: -1 }],
    ['an infinite timeout', { timeoutSeconds: Number.POSITIVE_INFINITY }],
    ['a timeout that is NaN', { timeoutSeconds: Number.NaN }],
    ['a timeout that is a string', { timeoutSeconds: '5' }],
    ['an invalid Date', { deadlineAt: new Date('not a date') }],
    ['a time that is NaN', { deadlineAt: Number.NaN }],
    ['a time of -Infinity', { deadlineAt: Number.NEGATIVE_INFINITY }],
    ['a time past what a Date holds', { deadlineAt: 8.64e15 + 1 }],
    ['a time that is a string', { deadlineAt: '2026-10-19' }],
    ['a signal that is not an AbortSignal', { timeoutSeconds: 5, signal: { aborted: false } }],
  ])('throws INVALID_DEADLINE for %s', (_, options) => {
    expectToThrowCode(
      () => createDeadline(options),
      ERRORS.INVALID_DEADLINE,
      'The deadline needs timeoutSeconds',
    );
  });
});
