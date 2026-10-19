// @vitest-environment node
import { expectToRejectCode, expectToThrowCode } from 'jg-exception/testing';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/errors.js';

import { createRequestCoordinator } from './request-coordinator.js';

afterEach(() => {
  vi.useRealTimers();
});

// a task that runs until the test releases it
const createBlockedTask = <T>(
  result: T,
): { task: () => Promise<T>; release: () => void; started: () => boolean } => {
  let release: () => void = () => undefined;
  let hasStarted = false;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    task: async () => {
      hasStarted = true;
      await barrier;
      return result;
    },
    release: () => {
      release();
    },
    started: () => hasStarted,
  };
};

describe('createRequestCoordinator', () => {
  test.each([0, -1, 1.5, Number.NaN])('rejects the concurrency limit %d', (maxConcurrent) => {
    expectToThrowCode(
      () => createRequestCoordinator({ maxConcurrent, maxQueued: 1 }),
      ERRORS.INVALID_CONCURRENCY_LIMIT,
      'The concurrency limit must be an integer of at least 1.',
    );
  });

  test.each([-1, 0.5, Number.POSITIVE_INFINITY])('rejects the queue limit %d', (maxQueued) => {
    expectToThrowCode(
      () => createRequestCoordinator({ maxConcurrent: 1, maxQueued }),
      ERRORS.INVALID_QUEUE_LIMIT,
      'The queue limit must be an integer of at least 0.',
    );
  });

  test('rejects a caller queue limit that is not an integer of at least 0', async () => {
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 1 });

    await expectToRejectCode(
      coordinator.run(() => Promise.resolve('ran'), { maxQueuedForCaller: -1 }),
      ERRORS.INVALID_QUEUE_LIMIT,
    );
  });

  test('runs no more than the configured number of tasks at once, in order', async () => {
    const coordinator = createRequestCoordinator({ maxConcurrent: 2, maxQueued: 4 });
    const blocked = [createBlockedTask('a'), createBlockedTask('b'), createBlockedTask('c')];
    const runs = blocked.map(({ task }) => coordinator.run(task));

    await Promise.resolve();
    expect(blocked.map(({ started }) => started())).toStrictEqual([true, true, false]);
    blocked[0]?.release();
    await vi.waitFor(() => {
      expect(blocked[2]?.started()).toBe(true);
    });
    blocked[1]?.release();
    blocked[2]?.release();

    await expect(Promise.all(runs)).resolves.toStrictEqual(['a', 'b', 'c']);
    expect(coordinator.isIdle()).toBe(true);
  });

  test("passes the task's own error through unchanged, and releases its slot", async () => {
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 1 });
    const failure = new TypeError('the request failed');

    await expect(coordinator.run(() => Promise.reject(failure))).rejects.toBe(failure);
    await expect(
      coordinator.run(() => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(coordinator.run(() => Promise.resolve('next'))).resolves.toBe('next');
    expect(coordinator.isIdle()).toBe(true);
  });

  test("rejects with an already aborted signal's reason without running the task", async () => {
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 1 });
    const controller = new AbortController();
    const reason = new Error('the user left');
    controller.abort(reason);
    const task = vi.fn(() => Promise.resolve('ran'));

    await expect(coordinator.run(task, { signal: controller.signal })).rejects.toBe(reason);
    expect(task).not.toHaveBeenCalled();
  });

  test('removes an aborted queued task without blocking later work', async () => {
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 2 });
    const active = createBlockedTask('active');
    const controller = new AbortController();
    const queuedTask = vi.fn(() => Promise.resolve('queued'));
    const finalTask = vi.fn(() => Promise.resolve('final'));
    const activeRun = coordinator.run(active.task);
    const queuedRun = coordinator.run(queuedTask, { signal: controller.signal });
    const finalRun = coordinator.run(finalTask);

    controller.abort(new Error('canceled'));
    await expect(queuedRun).rejects.toThrow('canceled');
    active.release();

    await expect(Promise.all([activeRun, finalRun])).resolves.toStrictEqual(['active', 'final']);
    expect(queuedTask).not.toHaveBeenCalled();
    expect(finalTask).toHaveBeenCalledOnce();
  });

  test("skips a queued task whose signal aborted, without its listener, before it's dequeued", async () => {
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 1 });
    const active = createBlockedTask('active');
    const signal = new AbortController().signal;
    const removeEventListener = vi.spyOn(signal, 'removeEventListener');
    const activeRun = coordinator.run(active.task);
    const queuedTask = vi.fn(() => Promise.resolve('queued'));
    const queuedRun = coordinator.run(queuedTask, { signal });
    Object.defineProperty(signal, 'aborted', { value: true });
    Object.defineProperty(signal, 'reason', { value: new Error('aborted unseen') });

    active.release();

    await expect(queuedRun).rejects.toThrow('aborted unseen');
    await expect(activeRun).resolves.toBe('active');
    expect(queuedTask).not.toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledOnce();
  });

  test('rejects work beyond the queue without running it, with the queue in its data', async () => {
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 1 });
    const active = createBlockedTask(undefined);
    const activeRun = coordinator.run(active.task);
    const queuedRun = coordinator.run(() => Promise.resolve('queued'));
    const rejectedTask = vi.fn(() => Promise.resolve('rejected'));

    const error: unknown = await coordinator.run(rejectedTask).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: ERRORS.REQUEST_QUEUE_FULL,
      message: 'The request queue is full.',
      data: { scope: 'global', queued: 1, limit: 1 },
    });
    expect(rejectedTask).not.toHaveBeenCalled();
    active.release();
    await expect(Promise.all([activeRun, queuedRun])).resolves.toStrictEqual([undefined, 'queued']);
  });

  test("caps a caller's queued tasks before the global queue, comparing callers with ===", async () => {
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 8 });
    const active = createBlockedTask('active');
    const tenant = { id: 'a' };
    const activeRun = coordinator.run(active.task);
    const tenantRun = coordinator.run(() => Promise.resolve('tenant'), {
      caller: tenant,
      maxQueuedForCaller: 1,
    });
    const otherTenantRun = coordinator.run(() => Promise.resolve('other'), {
      caller: { id: 'a' },
      maxQueuedForCaller: 1,
    });

    const error: unknown = await coordinator
      .run(() => Promise.resolve('over'), { caller: tenant, maxQueuedForCaller: 1 })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: ERRORS.REQUEST_QUEUE_FULL,
      data: { scope: 'caller', queued: 1, limit: 1 },
    });
    active.release();
    await expect(Promise.all([activeRun, tenantRun, otherTenantRun])).resolves.toStrictEqual([
      'active',
      'tenant',
      'other',
    ]);
  });

  test('groups the tasks without a caller together', async () => {
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 8 });
    const active = createBlockedTask('active');
    const activeRun = coordinator.run(active.task);
    const queuedRun = coordinator.run(() => Promise.resolve('queued'), { maxQueuedForCaller: 1 });

    await expectToRejectCode(
      coordinator.run(() => Promise.resolve('over'), { maxQueuedForCaller: 1 }),
      ERRORS.REQUEST_QUEUE_FULL,
    );
    active.release();
    await Promise.all([activeRun, queuedRun]);
  });

  test('rejects intake at once during a cooldown, without a waiter, slot, or timer', async () => {
    vi.useFakeTimers();
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 2 });
    const retryAt = Date.now() + 60_000;
    const task = vi.fn(() => Promise.resolve('completed'));
    coordinator.deferUntil(retryAt);

    const error: unknown = await coordinator
      .run(task, { rejectDuringCooldown: true })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: ERRORS.REQUEST_COOLDOWN_ACTIVE,
      message: 'Requests are paused until the cooldown ends.',
      data: { retryAt: new Date(retryAt).toISOString() },
    });
    expect(task).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(coordinator.isIdle()).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(coordinator.isIdle()).toBe(true);
    await expect(coordinator.run(task)).resolves.toBe('completed');
    expect(task).toHaveBeenCalledOnce();
  });

  test('rejects queued intake on a new cooldown, while the others wait it out', async () => {
    vi.useFakeTimers();
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 4 });
    const active = createBlockedTask('active');
    const activeRun = coordinator.run(active.task);
    const intakeTask = vi.fn(() => Promise.resolve('intake'));
    const intakeRun = coordinator.run(intakeTask, { rejectDuringCooldown: true });
    const ordinaryTask = vi.fn(() => Promise.resolve('ordinary'));
    const ordinaryRun = coordinator.run(ordinaryTask);

    coordinator.deferUntil(new Date(Date.now() + 60_000));
    await expectToRejectCode(intakeRun, ERRORS.REQUEST_COOLDOWN_ACTIVE);
    active.release();
    await expect(activeRun).resolves.toBe('active');
    expect(ordinaryTask).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);

    await expect(ordinaryRun).resolves.toBe('ordinary');
    expect(intakeTask).not.toHaveBeenCalled();
    expect(coordinator.isIdle()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('starts no timer when a new cooldown rejects every queued task', async () => {
    vi.useFakeTimers();
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 4 });
    const active = createBlockedTask('active');
    const activeRun = coordinator.run(active.task);
    const intakeRuns = [1, 2].map(() =>
      coordinator.run(() => Promise.resolve('intake'), { rejectDuringCooldown: true }),
    );

    coordinator.deferUntil(Date.now() + 60_000);

    for (const intakeRun of intakeRuns) {
      await expectToRejectCode(intakeRun, ERRORS.REQUEST_COOLDOWN_ACTIVE);
    }
    expect(vi.getTimerCount()).toBe(0);
    active.release();
    await expect(activeRun).resolves.toBe('active');
  });

  test('holds no slot during a cooldown longer than a timer allows, and isolates an abort', async () => {
    vi.useFakeTimers();
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 2 });
    coordinator.deferUntil(Date.now() + 2_147_483_648);
    const controller = new AbortController();
    const task = vi.fn(() => Promise.resolve(undefined));
    const pendingRun = coordinator.run(task, { signal: controller.signal });

    await vi.advanceTimersByTimeAsync(1);
    expect(task).not.toHaveBeenCalled();
    controller.abort(new Error('aborted'));
    await expect(pendingRun).rejects.toThrow('aborted');
    expect(vi.getTimerCount()).toBe(0);
    expect(coordinator.isIdle()).toBe(false);

    await vi.advanceTimersByTimeAsync(2_147_483_647);

    expect(coordinator.isIdle()).toBe(true);
    await coordinator.run(task);
    expect(task).toHaveBeenCalledOnce();
  });

  test('waits out a cooldown longer than a timer allows in steps', async () => {
    vi.useFakeTimers();
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 1 });
    coordinator.deferUntil(Date.now() + 2_147_483_647 + 1_000);
    const task = vi.fn(() => Promise.resolve('ran'));
    const run = coordinator.run(task);

    await vi.advanceTimersByTimeAsync(2_147_483_647);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(run).resolves.toBe('ran');
    expect(vi.getTimerCount()).toBe(0);
  });

  test('keeps the later deadline when deferred twice', async () => {
    vi.useFakeTimers();
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 1 });
    coordinator.deferUntil(Date.now() + 60_000);
    coordinator.deferUntil(Date.now() + 1_000);
    const task = vi.fn(() => Promise.resolve('ran'));
    const run = coordinator.run(task);

    await vi.advanceTimersByTimeAsync(59_000);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(run).resolves.toBe('ran');
  });

  test.each([new Date(Number.NaN), Number.NaN, Number.MAX_SAFE_INTEGER])(
    'rejects the deadline %o',
    (deadline) => {
      const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 1 });

      expectToThrowCode(
        () => coordinator.deferUntil(deadline),
        ERRORS.INVALID_DATE,
        'The deadline must be a valid Date or epoch milliseconds a Date accepts.',
      );
    },
  );

  test('closes: rejects the queued and later tasks, and lets the running one finish', async () => {
    vi.useFakeTimers();
    const coordinator = createRequestCoordinator({ maxConcurrent: 1, maxQueued: 4 });
    const active = createBlockedTask('active');
    const activeRun = coordinator.run(active.task);
    const queuedTask = vi.fn(() => Promise.resolve('queued'));
    const queuedRun = coordinator.run(queuedTask);
    coordinator.deferUntil(Date.now() + 60_000);
    const waitingRun = coordinator.run(queuedTask);

    coordinator.close();
    coordinator.close();

    await expectToRejectCode(queuedRun, ERRORS.REQUEST_COORDINATOR_CLOSED);
    await expectToRejectCode(waitingRun, ERRORS.REQUEST_COORDINATOR_CLOSED);
    await expectToRejectCode(
      coordinator.run(queuedTask),
      ERRORS.REQUEST_COORDINATOR_CLOSED,
      'The request coordinator is closed.',
    );
    expect(vi.getTimerCount()).toBe(0);
    active.release();
    await expect(activeRun).resolves.toBe('active');
    expect(queuedTask).not.toHaveBeenCalled();
  });
});
