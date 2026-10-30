// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectToRejectCode } from 'jg-exception/testing';
import { ERRORS as FS_ERRORS } from 'jg-fs';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS, MAX_LISTED_LOCKS } from './constants.js';
import { type IHolder, startHolder } from './holder.test-utils.js';
import { acquireLock, getLocksRoot, inspectLock, listLocks, withLock } from './locks.js';
import type { ILockState } from './types.js';

const IS_POSIX = process.platform !== 'win32';

/**
 * Gives the pid of a process that has exited, as a dead owner's.
 * @returns The pid.
 */
const getDeadPid = (): number => {
  const { pid } = spawnSync(process.execPath, ['-e', '']);
  if (pid === undefined) {
    throw new Error('The child process did not start.');
  }
  return pid;
};

let folder: string;
let root: string;
const holders: IHolder[] = [];

beforeEach(async () => {
  folder = await realpath(await mkdtemp(join(tmpdir(), 'jg-locks-')));
  root = join(folder, 'locks');
});

afterEach(async () => {
  await Promise.all(holders.splice(0).map((holder) => holder.kill()));
  await rm(folder, { recursive: true, force: true });
});

/**
 * Starts a holder that the test's teardown stops.
 * @param name The lock's name.
 * @param metadata What the holder writes about itself.
 * @returns A promise that resolves once it holds the lock.
 */
const hold = async (name: string, metadata?: Record<string, string>): Promise<IHolder> => {
  const holder = await startHolder(folder, name, root, metadata);
  holders.push(holder);
  return holder;
};

/**
 * Creates a lock's folder by hand, as an earlier process left it.
 * @param name The lock's name.
 * @param owner owner.json's record, or undefined for none.
 * @param extraEntries The names of other files in the folder.
 */
const createStaleLock = async (
  name: string,
  owner: Record<string, unknown> | undefined,
  extraEntries: string[] = [],
): Promise<void> => {
  await mkdir(join(root, name), { recursive: true, mode: 0o700 });
  await chmod(root, 0o700);
  if (owner !== undefined) {
    await writeFile(join(root, name, 'owner.json'), JSON.stringify({ version: 1, ...owner }));
  }
  for (const entry of extraEntries) {
    await mkdir(join(root, name, entry));
  }
};

describe('acquireLock', () => {
  test('creates a private locks folder, records the owner, and frees the lock on release', async () => {
    const lock = await acquireLock('acme.app.report', { root, metadata: { runId: 'run-1' } });
    expect(lock.name).toBe('acme.app.report');
    expect(lock.owner).toMatchObject({
      pid: process.pid,
      hostname: hostname(),
      cwd: process.cwd(),
      metadata: { runId: 'run-1' },
    });
    expect(Number.isNaN(Date.parse(lock.owner.startedAt ?? ''))).toBe(false);
    if (IS_POSIX) {
      expect((await stat(root)).mode & 0o777).toBe(0o700);
    }
    expect((await inspectLock('acme.app.report', { root })).state).toBe('held');
    await lock.release();
    expect((await inspectLock('acme.app.report', { root })).state).toBe('free');
  });

  test('excludes another process, and records its program without its arguments', async () => {
    const holder = await hold('acme.app.port-3000', { runId: 'run-2' });
    await expectToRejectCode(acquireLock('acme.app.port-3000', { root }), FS_ERRORS.LOCK_BUSY);
    const state = await inspectLock('acme.app.port-3000', { root });
    expect(state).toStrictEqual({
      name: 'acme.app.port-3000',
      state: 'held',
      owner: holder.owner,
      isOwnerAlive: true,
    });
    expect(holder.owner.program).toBe('holder.mjs');
    expect(holder.owner.metadata).toStrictEqual({ runId: 'run-2' });
    const record = await readFile(join(root, 'acme.app.port-3000', 'owner.json'), 'utf8');
    expect(record).not.toContain('secret-argument');
    expect(record).toContain(holder.owner.nonce);
  });

  test('waits until the holder releases, telling onWait about it once', async () => {
    const holder = await hold('acme.app.browser');
    const onWait = vi.fn<(state: ILockState) => void>();
    const acquiring = acquireLock('acme.app.browser', { root, waitSeconds: 30, onWait });
    await vi.waitFor(() => {
      expect(onWait).toHaveBeenCalledTimes(1);
    });
    expect(onWait.mock.calls[0]?.[0]).toMatchObject({ state: 'held', owner: holder.owner });
    await holder.release();
    const lock = await acquiring;
    expect(lock.owner.pid).toBe(process.pid);
    expect(onWait).toHaveBeenCalledTimes(1);
    await lock.release();
  });

  test('fails with LOCK_BUSY held once the wait runs out', async () => {
    await hold('acme.app.browser');
    const startedAt = performance.now();
    await expect(acquireLock('acme.app.browser', { root, waitSeconds: 0.3 })).rejects.toMatchObject(
      { code: FS_ERRORS.LOCK_BUSY, data: { reason: 'held' } },
    );
    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(250);
  });

  test("waits without a limit for Infinity, until the signal aborts with the signal's reason", async () => {
    await hold('acme.app.browser');
    const controller = new AbortController();
    const reason = new Error('stopped by the test');
    const onWait = vi.fn<(state: ILockState) => void>();
    const acquiring = acquireLock('acme.app.browser', {
      root,
      waitSeconds: Infinity,
      signal: controller.signal,
      onWait,
    });
    await vi.waitFor(() => {
      expect(onWait).toHaveBeenCalled();
    });
    controller.abort(reason);
    await expect(acquiring).rejects.toBe(reason);
  });

  test("rejects with an already aborted signal's reason before taking the lock", async () => {
    const reason = new Error('already stopped');
    await expect(
      acquireLock('acme.app.browser', { root, signal: AbortSignal.abort(reason) }),
    ).rejects.toBe(reason);
    expect((await inspectLock('acme.app.browser', { root })).state).toBe('free');
  });

  test.each([
    ['owner-gone', () => ({ pid: getDeadPid(), nonce: 'n', hostname: hostname() }), []],
    ['other-host', () => ({ pid: process.pid, nonce: 'n', hostname: 'another-host' }), []],
    [
      'unexpected-entries',
      () => ({ pid: getDeadPid(), nonce: 'n', hostname: hostname() }),
      ['partial-write'],
    ],
    [
      'recovery-in-progress',
      () => ({ pid: getDeadPid(), nonce: 'n', hostname: hostname() }),
      ['recovery'],
    ],
  ] as const)('fails at once for %s, even without a wait limit', async (reason, owner, extra) => {
    await createStaleLock('acme.app.stale', owner(), [...extra]);
    await expect(
      acquireLock('acme.app.stale', { root, waitSeconds: Infinity }),
    ).rejects.toMatchObject({ code: FS_ERRORS.LOCK_BUSY, data: { reason } });
    expect((await inspectLock('acme.app.stale', { root })).state).toBe(reason);
  });

  test('fails for a lock without an owner once the wait runs out, and takes it once it goes', async () => {
    await createStaleLock('acme.app.new', undefined);
    await expect(acquireLock('acme.app.new', { root })).rejects.toMatchObject({
      code: FS_ERRORS.LOCK_BUSY,
      data: { reason: 'ownerless' },
    });
    await expect(acquireLock('acme.app.new', { root, waitSeconds: 0.3 })).rejects.toMatchObject({
      code: FS_ERRORS.LOCK_BUSY,
      data: { reason: 'ownerless' },
    });
    const acquiring = acquireLock('acme.app.new', { root, waitSeconds: 10 });
    await rm(join(root, 'acme.app.new'), { recursive: true });
    const lock = await acquiring;
    expect(lock.owner.pid).toBe(process.pid);
    await lock.release();
  });

  test('takes a lock over only from the exact dead owner it is given', async () => {
    const holder = await hold('acme.app.fixture');
    await holder.kill();
    const state = await inspectLock('acme.app.fixture', { root });
    expect(state).toMatchObject({ state: 'owner-gone', isOwnerAlive: false, owner: holder.owner });
    await expect(
      acquireLock('acme.app.fixture', {
        root,
        recoverFrom: { ...holder.owner, nonce: 'another-nonce' },
      }),
    ).rejects.toMatchObject({ code: FS_ERRORS.LOCK_BUSY, data: { reason: 'owner-gone' } });
    const lock = await acquireLock('acme.app.fixture', { root, recoverFrom: holder.owner });
    expect(lock.owner.pid).toBe(process.pid);
    expect((await inspectLock('acme.app.fixture', { root })).owner?.nonce).toBe(lock.owner.nonce);
    await lock.release();
  });

  test('throws LOCK_NAME_INVALID, LOCK_OPTIONS_INVALID, and LOCK_ROOT_INVALID before touching the disk', async () => {
    await expectToRejectCode(acquireLock('Bad', { root }), ERRORS.LOCK_NAME_INVALID);
    await expectToRejectCode(
      acquireLock('acme.app.x', { root, waitSeconds: -1 }),
      ERRORS.LOCK_OPTIONS_INVALID,
    );
    await expectToRejectCode(
      acquireLock('acme.app.x', { root: 'relative/locks' }),
      ERRORS.LOCK_ROOT_INVALID,
    );
    await expect(stat(root)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test.runIf(IS_POSIX)('refuses a locks folder other users can open', async () => {
    await mkdir(root, { mode: 0o755 });
    await chmod(root, 0o755);
    await expectToRejectCode(acquireLock('acme.app.x', { root }), FS_ERRORS.DIRECTORY_NOT_PRIVATE);
  });

  test('uses JG_LOCKS_ROOT when no folder is given', async () => {
    vi.stubEnv('JG_LOCKS_ROOT', root);
    expect(getLocksRoot()).toBe(root);
    const lock = await acquireLock('acme.app.default');
    expect((await inspectLock('acme.app.default', { root })).state).toBe('held');
    expect((await listLocks()).locks.map(({ name }) => name)).toStrictEqual(['acme.app.default']);
    await lock.release();
  });
});

describe('withLock', () => {
  test('releases the lock after the function resolves, and after it throws', async () => {
    const result = await withLock('acme.app.job', { root }, async (lock) => {
      expect((await inspectLock(lock.name, { root })).state).toBe('held');
      return 'done';
    });
    expect(result).toBe('done');
    expect((await inspectLock('acme.app.job', { root })).state).toBe('free');
    await expect(
      withLock('acme.app.job', { root }, () => {
        throw new Error('the job failed');
      }),
    ).rejects.toThrow('the job failed');
    expect((await inspectLock('acme.app.job', { root })).state).toBe('free');
  });
});

describe('inspectLock', () => {
  test('reads a missing lock, and a missing locks folder, as free', async () => {
    expect(await inspectLock('acme.app.none', { root })).toStrictEqual({
      name: 'acme.app.none',
      state: 'free',
      owner: null,
      isOwnerAlive: null,
    });
  });

  test('reads a lock without an owner.json as ownerless, and one owned elsewhere without liveness', async () => {
    await createStaleLock('acme.app.new', undefined);
    expect(await inspectLock('acme.app.new', { root })).toStrictEqual({
      name: 'acme.app.new',
      state: 'ownerless',
      owner: null,
      isOwnerAlive: null,
    });
    await createStaleLock('acme.app.remote', { pid: 1, nonce: 'n', hostname: 'another-host' });
    expect(await inspectLock('acme.app.remote', { root })).toMatchObject({
      state: 'other-host',
      isOwnerAlive: null,
    });
  });

  test('throws NOT_A_DIRECTORY for a file where the lock would be', async () => {
    await mkdir(root, { mode: 0o700 });
    await writeFile(join(root, 'acme.app.file'), '');
    await expectToRejectCode(inspectLock('acme.app.file', { root }), FS_ERRORS.NOT_A_DIRECTORY);
  });
});

describe('reading errors', () => {
  test.runIf(IS_POSIX && process.getuid?.() !== 0)(
    'propagates an error reading the locks folder, other than a missing folder',
    async () => {
      await mkdir(root, { mode: 0o700 });
      await chmod(root, 0o000);
      try {
        await expect(listLocks({ root })).rejects.toMatchObject({ code: 'EACCES' });
        await expect(inspectLock('acme.app.x', { root })).rejects.toMatchObject({
          code: 'EACCES',
        });
      } finally {
        await chmod(root, 0o700);
      }
    },
  );
});

describe('listLocks', () => {
  test('lists the present locks sorted by name, without files, other names, or free ones', async () => {
    expect(await listLocks({ root })).toStrictEqual({ locks: [], isTruncated: false });
    const lock = await acquireLock('b.lock', { root });
    await createStaleLock('a.lock', { pid: getDeadPid(), nonce: 'n', hostname: hostname() });
    await createStaleLock('Not-A-Lock', undefined);
    await writeFile(join(root, 'c.lock'), '');
    const { locks, isTruncated } = await listLocks({ root });
    expect(locks.map(({ name, state }) => [name, state])).toStrictEqual([
      ['a.lock', 'owner-gone'],
      ['b.lock', 'held'],
    ]);
    expect(isTruncated).toBe(false);
    await lock.release();
    expect((await listLocks({ root })).locks.map(({ name }) => name)).toStrictEqual(['a.lock']);
  });

  test('returns at most 256 locks, and says when there were more', async () => {
    const owner = { pid: getDeadPid(), nonce: 'n', hostname: hostname() };
    const names = Array.from(
      { length: MAX_LISTED_LOCKS + 1 },
      (_, index) => `lock-${String(index).padStart(3, '0')}`,
    );
    await mkdir(root, { mode: 0o700 });
    await Promise.all(names.map((name) => createStaleLock(name, owner)));
    const { locks, isTruncated } = await listLocks({ root });
    expect(locks).toHaveLength(MAX_LISTED_LOCKS);
    expect(locks[0]?.name).toBe('lock-000');
    expect(locks.at(-1)?.name).toBe('lock-255');
    expect(isTruncated).toBe(true);
  });
});
