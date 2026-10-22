import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  ASTRO_FIXTURE_LIMITS,
  createAstroFixtureScope,
  type IAstroFixtureScope,
  type IRunAstroFixtureCommand,
} from './index.ts';

const SUCCESS = { exitCode: 0, signalCode: null, stdout: '', stderr: '', durationMs: 0 };
let scope: IAstroFixtureScope | undefined;
afterEach(() => {
  scope?.dispose();
  scope = undefined;
  vi.useRealTimers();
});

describe('createAstroFixtureScope', () => {
  test('does not start a command after caller cancellation', async () => {
    const abort = new AbortController();
    const reason = new Error('caller cancelled');
    abort.abort(reason);
    const executor = vi.fn<IRunAstroFixtureCommand>();
    scope = createAstroFixtureScope(executor, ASTRO_FIXTURE_LIMITS, abort.signal);
    await expect(
      scope.run('unused', [], { cwd: '.', signal: scope.signal, timeoutSeconds: 10 }),
    ).rejects.toBe(reason);
    expect(executor).not.toHaveBeenCalled();
  });

  test('rejects a completed stage after cancellation and starts no later command', async () => {
    const abort = new AbortController();
    const reason = new Error('cancelled during stage');
    const executor = vi.fn<IRunAstroFixtureCommand>(() => {
      abort.abort(reason);
      return Promise.resolve(SUCCESS);
    });
    scope = createAstroFixtureScope(executor, ASTRO_FIXTURE_LIMITS, abort.signal);
    const options = { cwd: '.', signal: scope.signal, timeoutSeconds: 10 };
    await expect(scope.run('first', [], options)).rejects.toBe(reason);
    await expect(scope.run('second', [], options)).rejects.toBe(reason);
    expect(executor).toHaveBeenCalledTimes(1);
  });

  test('expires between stages and releases its timer and shutdown listeners', async () => {
    vi.useFakeTimers();
    const baseline = [process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')];
    const executor = vi.fn<IRunAstroFixtureCommand>(() => Promise.resolve(SUCCESS));
    scope = createAstroFixtureScope(executor, { ...ASTRO_FIXTURE_LIMITS, total: 1 });
    await scope.run('first', [], { cwd: '.', signal: scope.signal, timeoutSeconds: 10 });
    expect(executor.mock.calls[0]?.[2].timeoutSeconds).toBeLessThanOrEqual(1);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(
      scope.run('second', [], { cwd: '.', signal: scope.signal, timeoutSeconds: 10 }),
    ).rejects.toThrow('The Astro gallery exceeded its overall deadline.');
    expect(executor).toHaveBeenCalledTimes(1);
    expect(scope.isInterrupted()).toBe(false);
    scope.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect([process.listenerCount('SIGINT'), process.listenerCount('SIGTERM')]).toStrictEqual(
      baseline,
    );
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_484])(
    'rejects an invalid total limit %s',
    (total) => {
      expect(() => createAstroFixtureScope(undefined, { ...ASTRO_FIXTURE_LIMITS, total })).toThrow(
        'Astro fixture limits must be finite positive seconds within Node.js timer bounds.',
      );
    },
  );
});
