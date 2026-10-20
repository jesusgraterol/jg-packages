// @vitest-environment node
import { constants } from 'node:os';

import { expectToThrowCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { createShutdownSignal } from './shutdown-signal.js';
import type { IShutdownSignal } from './types.js';

/*
 * The tests emit SIGHUP and SIGWINCH in-process, never SIGINT or SIGTERM, which the test runner's
 * own workers may listen for. A child process checks SIGINT and SIGTERM for real.
 */
const SIGNALS: NodeJS.Signals[] = ['SIGHUP', 'SIGWINCH'];

let savedExitCode: typeof process.exitCode;
let shutdown: IShutdownSignal | undefined;

beforeEach(() => {
  savedExitCode = process.exitCode;
});

afterEach(() => {
  shutdown?.dispose();
  shutdown = undefined;
  process.exitCode = savedExitCode;
});

/**
 * Counts the process's listeners for each signal the tests use, and the default ones.
 * @returns The counts, by signal.
 */
const countListeners = (): Record<string, number> =>
  Object.fromEntries(
    [...SIGNALS, 'SIGINT', 'SIGTERM'].map((signal) => [signal, process.listenerCount(signal)]),
  );

describe('createShutdownSignal', () => {
  test('listens for SIGINT and SIGTERM by default, and stops listening at dispose', () => {
    const baseline = countListeners();

    shutdown = createShutdownSignal();

    expect(countListeners()).toStrictEqual({
      ...baseline,
      SIGINT: (baseline['SIGINT'] ?? 0) + 1,
      SIGTERM: (baseline['SIGTERM'] ?? 0) + 1,
    });
    expect(shutdown.receivedSignal()).toBeNull();
    expect(shutdown.exitCode()).toBeNull();
    shutdown.dispose();
    expect(countListeners()).toStrictEqual(baseline);
  });

  test('aborts at the first signal, sets the exit code, and calls onSignal once', () => {
    const onSignal = vi.fn();
    shutdown = createShutdownSignal({ signals: SIGNALS, onSignal });
    const exitCode = 128 + constants.signals.SIGHUP;

    process.emit('SIGHUP', 'SIGHUP');

    expect(shutdown.signal.aborted).toBe(true);
    expect(shutdown.signal.reason).toMatchObject({
      code: ERRORS.PROCESS_INTERRUPTED,
      message: 'The process was interrupted by SIGHUP.',
      data: { signal: 'SIGHUP', exitCode },
    });
    expect(process.exitCode).toBe(exitCode);
    expect(shutdown.receivedSignal()).toBe('SIGHUP');
    expect(shutdown.exitCode()).toBe(exitCode);
    expect(onSignal).toHaveBeenCalledExactlyOnceWith('SIGHUP');
  });

  test('ignores later signals, keeping its listeners', () => {
    const onSignal = vi.fn();
    shutdown = createShutdownSignal({ signals: SIGNALS, onSignal });
    process.emit('SIGHUP', 'SIGHUP');
    const listeners = countListeners();

    process.emit('SIGWINCH', 'SIGWINCH');
    process.emit('SIGHUP', 'SIGHUP');

    expect(shutdown.receivedSignal()).toBe('SIGHUP');
    expect(process.exitCode).toBe(128 + constants.signals.SIGHUP);
    expect(onSignal).toHaveBeenCalledOnce();
    expect(countListeners()).toStrictEqual(listeners);
  });

  test('stops listening after the first signal with forceOnRepeat, so the next gets the default', () => {
    const baseline = countListeners();
    shutdown = createShutdownSignal({ signals: SIGNALS, forceOnRepeat: true });

    process.emit('SIGWINCH', 'SIGWINCH');

    expect(shutdown.receivedSignal()).toBe('SIGWINCH');
    expect(countListeners()).toStrictEqual(baseline);
  });

  test('leaves process.exitCode alone with setExitCode: false', () => {
    process.exitCode = undefined;
    shutdown = createShutdownSignal({ signals: SIGNALS, setExitCode: false });

    process.emit('SIGHUP', 'SIGHUP');

    expect(process.exitCode).toBeUndefined();
    expect(shutdown.exitCode()).toBe(128 + constants.signals.SIGHUP);
  });

  test('never aborts after dispose, and dispose is idempotent', () => {
    const baseline = countListeners();
    shutdown = createShutdownSignal({ signals: SIGNALS });

    shutdown.dispose();
    shutdown.dispose();
    process.emit('SIGHUP', 'SIGHUP');

    expect(shutdown.signal.aborted).toBe(false);
    expect(countListeners()).toStrictEqual(baseline);
  });

  test('listens once for a signal listed twice', () => {
    const baseline = countListeners();

    shutdown = createShutdownSignal({ signals: ['SIGHUP', 'SIGHUP'] });

    expect(process.listenerCount('SIGHUP')).toBe((baseline['SIGHUP'] ?? 0) + 1);
  });

  test.each([
    [
      'throws',
      () => {
        throw new Error('the logger failed');
      },
    ],
    ['rejects', () => Promise.reject(new Error('the logger failed'))],
  ])('ignores an onSignal that %s, and still aborts', async (_, onSignal) => {
    shutdown = createShutdownSignal({ signals: SIGNALS, onSignal });

    process.emit('SIGHUP', 'SIGHUP');
    await Promise.resolve();

    expect(shutdown.signal.aborted).toBe(true);
  });

  test.each<[string, Record<string, unknown>]>([
    ['an empty list', { signals: [] }],
    ['a single name instead of a list', { signals: 'SIGINT' }],
    ['an unknown signal', { signals: ['SIGINT', 'SIGFOO'] }],
    ['SIGKILL', { signals: ['SIGKILL'] }],
    ['SIGSTOP', { signals: ['SIGSTOP'] }],
    ['a number', { signals: [2] }],
    ['an onSignal that is not a function', { onSignal: 'log' }],
  ])('throws INVALID_SIGNAL for %s, listening for nothing', (_, options) => {
    const baseline = countListeners();

    expectToThrowCode(
      () => createShutdownSignal(options),
      ERRORS.INVALID_SIGNAL,
      'The shutdown needs a non-empty list of signals',
    );
    expect(countListeners()).toStrictEqual(baseline);
  });
});

describe('createShutdownSignal with disconnect, in-process', () => {
  /*
   * Emitting 'disconnect' would reach the test runner's own worker, so the tests stand in for the
   * IPC channel: process.send and process.connected say whether there's one, and the listener the
   * shutdown adds is called directly.
   */
  const restorers: (() => void)[] = [];

  // replaces one of the process's IPC properties until the test ends
  const stubProcessProperty = (key: 'send' | 'connected', value: unknown): void => {
    const original = Object.getOwnPropertyDescriptor(process, key);
    Object.defineProperty(process, key, { configurable: true, writable: true, value });
    restorers.push(() => {
      if (original === undefined) {
        Reflect.deleteProperty(process, key);
      } else {
        Object.defineProperty(process, key, original);
      }
    });
  };

  afterEach(() => {
    for (const restore of restorers.splice(0).reverse()) {
      restore();
    }
    vi.restoreAllMocks();
  });

  test('shuts down as with SIGTERM when the channel closes, and stops listening at dispose', () => {
    stubProcessProperty('send', () => true);
    stubProcessProperty('connected', true);
    const on = vi.spyOn(process, 'on');
    const off = vi.spyOn(process, 'off');
    shutdown = createShutdownSignal({ signals: SIGNALS, disconnect: true, setExitCode: false });
    const call = on.mock.calls.find(([event]) => event === 'disconnect');
    const listener = call?.[1] as () => void;

    listener();

    expect(shutdown.signal.aborted).toBe(true);
    expect(shutdown.receivedSignal()).toBe('SIGTERM');
    expect(shutdown.exitCode()).toBe(128 + constants.signals.SIGTERM);
    shutdown.dispose();
    expect(off).toHaveBeenCalledWith('disconnect', listener);
  });

  test('shuts down at once when the channel already closed', () => {
    stubProcessProperty('send', () => true);
    stubProcessProperty('connected', false);

    shutdown = createShutdownSignal({ signals: SIGNALS, disconnect: true, setExitCode: false });

    expect(shutdown.signal.aborted).toBe(true);
    expect(shutdown.receivedSignal()).toBe('SIGTERM');
  });

  test('watches nothing without an IPC channel', () => {
    stubProcessProperty('send', undefined);
    const on = vi.spyOn(process, 'on');

    shutdown = createShutdownSignal({ signals: SIGNALS, disconnect: true });

    expect(shutdown.signal.aborted).toBe(false);
    expect(on.mock.calls.some(([event]) => event === 'disconnect')).toBe(false);
  });
});
