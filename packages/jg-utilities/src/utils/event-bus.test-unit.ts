// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createEventBus } from './event-bus.js';

type ITestEvents = {
  userSignedUp: { userId: string };
  orderPaid: { orderId: number };
};

describe('createEventBus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('delivers each event later, in the order it was emitted, to every handler', async () => {
    const events = createEventBus<ITestEvents>({ onError: vi.fn() });
    const received: string[] = [];
    events.subscribe('userSignedUp', ({ userId }) => {
      received.push(`first:${userId}`);
    });
    events.subscribe('userSignedUp', ({ userId }) => {
      received.push(`second:${userId}`);
    });

    events.emit('userSignedUp', { userId: 'a' });
    events.emit('userSignedUp', { userId: 'b' });
    expect(received).toStrictEqual([]);

    await vi.runAllTimersAsync();
    expect(received).toStrictEqual(['first:a', 'second:a', 'first:b', 'second:b']);
  });

  test('delivers only to the handlers of the emitted event', async () => {
    const events = createEventBus<ITestEvents>({ onError: vi.fn() });
    const signUps = vi.fn();
    const payments = vi.fn();
    events.subscribe('userSignedUp', signUps);
    events.subscribe('orderPaid', payments);

    events.emit('orderPaid', { orderId: 7 });
    await vi.runAllTimersAsync();

    expect(signUps).not.toHaveBeenCalled();
    expect(payments).toHaveBeenCalledExactlyOnceWith({ orderId: 7 });
  });

  test('emits an event without handlers without failing', async () => {
    const onError = vi.fn();
    const events = createEventBus<ITestEvents>({ onError });

    events.emit('orderPaid', { orderId: 7 });
    await vi.runAllTimersAsync();

    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('delivers to a handler subscribed after the emit but before the dispatch', async () => {
    const events = createEventBus<ITestEvents>({ onError: vi.fn() });
    const handler = vi.fn();

    events.emit('userSignedUp', { userId: 'a' });
    events.subscribe('userSignedUp', handler);
    await vi.runAllTimersAsync();

    expect(handler).toHaveBeenCalledExactlyOnceWith({ userId: 'a' });
  });

  test('sends what a handler throws or rejects with to onError, and still calls the others', async () => {
    const onError = vi.fn();
    const events = createEventBus<ITestEvents>({ onError });
    const thrown = new Error('sync failure');
    const rejected = new Error('async failure');
    const healthy = vi.fn();
    events.subscribe('userSignedUp', () => {
      throw thrown;
    });
    events.subscribe('userSignedUp', async () => {
      await Promise.resolve();
      throw rejected;
    });
    events.subscribe('userSignedUp', healthy);

    events.emit('userSignedUp', { userId: 'a' });
    await vi.runAllTimersAsync();

    expect(healthy).toHaveBeenCalledExactlyOnceWith({ userId: 'a' });
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(thrown, {
      name: 'userSignedUp',
      event: { userId: 'a' },
    });
    expect(onError).toHaveBeenCalledWith(rejected, {
      name: 'userSignedUp',
      event: { userId: 'a' },
    });
  });

  test('swallows what onError throws, so nothing goes unhandled', async () => {
    const onError = vi.fn(() => {
      throw new Error('the reporter failed');
    });
    const events = createEventBus<ITestEvents>({ onError });
    const healthy = vi.fn();
    events.subscribe('userSignedUp', () => Promise.reject(new Error('failure')));
    events.subscribe('userSignedUp', healthy);

    events.emit('userSignedUp', { userId: 'a' });
    await vi.runAllTimersAsync();

    expect(onError).toHaveBeenCalledOnce();
    expect(healthy).toHaveBeenCalledOnce();
  });

  test('skips a handler unsubscribed before the dispatch, or by an earlier handler', async () => {
    const events = createEventBus<ITestEvents>({ onError: vi.fn() });
    const unsubscribedEarly = vi.fn();
    const unsubscribedByFirst = vi.fn();
    const unsubscribeEarly = events.subscribe('userSignedUp', unsubscribedEarly);
    let unsubscribeLater = (): void => undefined;
    events.subscribe('userSignedUp', () => {
      unsubscribeLater();
    });
    unsubscribeLater = events.subscribe('userSignedUp', unsubscribedByFirst);

    events.emit('userSignedUp', { userId: 'a' });
    unsubscribeEarly();
    await vi.runAllTimersAsync();

    expect(unsubscribedEarly).not.toHaveBeenCalled();
    expect(unsubscribedByFirst).not.toHaveBeenCalled();
  });

  test('registers a handler subscribed twice to one event once', async () => {
    const events = createEventBus<ITestEvents>({ onError: vi.fn() });
    const handler = vi.fn();
    events.subscribe('userSignedUp', handler);
    events.subscribe('userSignedUp', handler);

    events.emit('userSignedUp', { userId: 'a' });
    await vi.runAllTimersAsync();

    expect(handler).toHaveBeenCalledOnce();
  });

  test('cancels the queued dispatches on close, and ignores later emits and subscriptions', async () => {
    const events = createEventBus<ITestEvents>({ onError: vi.fn() });
    const handler = vi.fn();
    events.subscribe('userSignedUp', handler);
    events.emit('userSignedUp', { userId: 'queued' });

    events.close();
    const lateHandler = vi.fn();
    const unsubscribe = events.subscribe('userSignedUp', lateHandler);
    events.emit('userSignedUp', { userId: 'late' });
    await vi.runAllTimersAsync();

    expect(handler).not.toHaveBeenCalled();
    expect(lateHandler).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(() => unsubscribe()).not.toThrow();
  });

  test('skips the handlers still waiting when an earlier one closes the bus', async () => {
    const events = createEventBus<ITestEvents>({ onError: vi.fn() });
    const later = vi.fn();
    events.subscribe('userSignedUp', () => {
      events.close();
    });
    events.subscribe('userSignedUp', later);

    events.emit('userSignedUp', { userId: 'a' });
    await vi.runAllTimersAsync();

    expect(later).not.toHaveBeenCalled();
  });
});
