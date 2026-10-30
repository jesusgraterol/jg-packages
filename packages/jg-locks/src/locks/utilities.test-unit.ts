// @vitest-environment node
import { Exception } from 'jg-exception';
import { expectToThrowCode } from 'jg-exception/testing';
import { ERRORS as FS_ERRORS } from 'jg-fs';
import { describe, expect, test } from 'vitest';

import { ERRORS, OWNERLESS_GRACE_MS } from './constants.js';
import type { ILockOwner } from './types.js';
import {
  assertLockName,
  assertLocksRoot,
  assertWaitSeconds,
  buildOwnerMetadata,
  isLockName,
  judgeLock,
  readLockBusy,
  readProgramName,
  resolveLocksRoot,
  shouldKeepWaiting,
  toFileLockOwner,
  toLockOwner,
} from './utilities.js';

const OWNER: ILockOwner = {
  pid: 4242,
  nonce: 'nonce-1',
  hostname: 'laptop',
  program: 'dev.js',
  cwd: '/srv/app',
  startedAt: '2026-10-29T12:00:00.000Z',
  metadata: { runId: 'run-1' },
};

describe('isLockName', () => {
  test.each([
    ['a', true],
    ['port-3101', true],
    ['acme.app.cloud-browser', true],
    ['under_score.1', true],
    ['9lives', true],
    ['a'.repeat(128), true],
    ['a'.repeat(129), false],
    ['', false],
    ['.hidden', false],
    ['-dash', false],
    ['_under', false],
    ['Upper', false],
    ['with space', false],
    ['slash/name', false],
    ['back\\slash', false],
    ['trailing.', false],
    ['con', false],
    ['nul.txt', false],
    ['com1', false],
    ['lpt9.lock', false],
    ['console', true],
    ['com10', true],
  ])('isLockName(%s) -> %s', (name, expected) => {
    expect(isLockName(name)).toBe(expected);
  });

  test('refuses a value that is not a string', () => {
    expect(isLockName(42)).toBe(false);
    expect(isLockName(undefined)).toBe(false);
  });
});

describe('assertLockName', () => {
  test('throws LOCK_NAME_INVALID with the name, cut to 256 characters, in its data', () => {
    expectToThrowCode(() => assertLockName('Bad Name'), ERRORS.LOCK_NAME_INVALID);
    try {
      assertLockName('X'.repeat(300));
    } catch (error) {
      expect((error as Exception).data).toStrictEqual({ name: 'X'.repeat(256) });
    }
    expectToThrowCode(() => assertLockName(7), ERRORS.LOCK_NAME_INVALID);
  });

  test('accepts a valid name', () => {
    expect(() => assertLockName('acme.app.port-3000')).not.toThrow();
  });
});

describe('resolveLocksRoot', () => {
  test('uses JG_LOCKS_ROOT first, normalized, on every platform', () => {
    expect(resolveLocksRoot({ JG_LOCKS_ROOT: '/tmp/locks/' }, 'linux', '/home/ada')).toBe(
      '/tmp/locks/',
    );
    expect(resolveLocksRoot({ JG_LOCKS_ROOT: '/tmp//a/../locks' }, 'darwin', '/Users/ada')).toBe(
      '/tmp/locks',
    );
    expect(
      resolveLocksRoot(
        { JG_LOCKS_ROOT: 'D:\\locks', LOCALAPPDATA: 'C:\\Users\\ada\\AppData\\Local' },
        'win32',
        'C:\\Users\\ada',
      ),
    ).toBe('D:\\locks');
  });

  test('throws LOCK_ROOT_INVALID for a relative JG_LOCKS_ROOT', () => {
    expectToThrowCode(
      () => resolveLocksRoot({ JG_LOCKS_ROOT: 'locks' }, 'linux', '/home/ada'),
      ERRORS.LOCK_ROOT_INVALID,
    );
  });

  test('ignores an empty JG_LOCKS_ROOT', () => {
    expect(resolveLocksRoot({ JG_LOCKS_ROOT: '' }, 'linux', '/home/ada')).toBe(
      '/home/ada/.local/state/jg-locks',
    );
  });

  test('uses an absolute XDG_STATE_HOME on Linux and macOS, and ignores a relative one', () => {
    expect(resolveLocksRoot({ XDG_STATE_HOME: '/var/state' }, 'linux', '/home/ada')).toBe(
      '/var/state/jg-locks',
    );
    expect(resolveLocksRoot({ XDG_STATE_HOME: 'state' }, 'darwin', '/Users/ada')).toBe(
      '/Users/ada/.local/state/jg-locks',
    );
    expect(resolveLocksRoot({}, 'linux', '/home/ada')).toBe('/home/ada/.local/state/jg-locks');
  });

  test('throws LOCK_ROOT_INVALID for a home folder that is not absolute', () => {
    expectToThrowCode(() => resolveLocksRoot({}, 'linux', ''), ERRORS.LOCK_ROOT_INVALID);
  });

  test('uses %LOCALAPPDATA% on Windows, which must be absolute', () => {
    expect(
      resolveLocksRoot(
        { LOCALAPPDATA: 'C:\\Users\\ada\\AppData\\Local' },
        'win32',
        'C:\\Users\\ada',
      ),
    ).toBe('C:\\Users\\ada\\AppData\\Local\\jg-locks');
    expectToThrowCode(
      () => resolveLocksRoot({}, 'win32', 'C:\\Users\\ada'),
      ERRORS.LOCK_ROOT_INVALID,
    );
    expectToThrowCode(
      () => resolveLocksRoot({ LOCALAPPDATA: 'AppData' }, 'win32', 'C:\\Users\\ada'),
      ERRORS.LOCK_ROOT_INVALID,
    );
  });
});

describe('assertLocksRoot', () => {
  test('accepts an absolute path for the platform, and throws LOCK_ROOT_INVALID otherwise', () => {
    expect(() => assertLocksRoot('/tmp/locks', 'linux')).not.toThrow();
    expect(() => assertLocksRoot('C:\\locks', 'win32')).not.toThrow();
    expectToThrowCode(() => assertLocksRoot('locks', 'linux'), ERRORS.LOCK_ROOT_INVALID);
    expectToThrowCode(() => assertLocksRoot('C:locks', 'win32'), ERRORS.LOCK_ROOT_INVALID);
    expectToThrowCode(() => assertLocksRoot(5, 'linux'), ERRORS.LOCK_ROOT_INVALID);
  });
});

describe('assertWaitSeconds', () => {
  test.each([[0], [0.25], [120], [Infinity]])('accepts %s', (waitSeconds) => {
    expect(() => assertWaitSeconds(waitSeconds)).not.toThrow();
  });

  test.each([[-1], [Number.NaN], [-Infinity], ['5'], [null]])(
    'throws LOCK_OPTIONS_INVALID for %s',
    (waitSeconds) => {
      expectToThrowCode(() => assertWaitSeconds(waitSeconds), ERRORS.LOCK_OPTIONS_INVALID);
    },
  );
});

describe('shouldKeepWaiting', () => {
  test('waits for a held lock while time remains, without a limit for Infinity', () => {
    expect(shouldKeepWaiting('held', 1, 0)).toBe(true);
    expect(shouldKeepWaiting('held', Infinity, 0)).toBe(true);
    expect(shouldKeepWaiting('held', 0, 0)).toBe(false);
    expect(shouldKeepWaiting('held', -5, 0)).toBe(false);
  });

  test('waits for an ownerless lock for at most the 16-second grace, and only while time remains', () => {
    expect(OWNERLESS_GRACE_MS).toBe(16_000);
    expect(shouldKeepWaiting('ownerless', Infinity, 0)).toBe(true);
    expect(shouldKeepWaiting('ownerless', Infinity, 15_999)).toBe(true);
    expect(shouldKeepWaiting('ownerless', Infinity, 16_000)).toBe(false);
    expect(shouldKeepWaiting('ownerless', 0, 0)).toBe(false);
  });

  test.each([
    ['owner-gone'],
    ['other-host'],
    ['recovery-in-progress'],
    ['unexpected-entries'],
  ] as const)('fails at once for %s, however long the wait', (reason) => {
    expect(shouldKeepWaiting(reason, Infinity, 0)).toBe(false);
  });
});

describe('readLockBusy', () => {
  test("reads jg-fs's LOCK_BUSY reason and pid", () => {
    const busy = new Exception('busy', {
      code: FS_ERRORS.LOCK_BUSY,
      data: { path: '/x', reason: 'held', pid: 7, hostname: 'laptop' },
    });
    expect(readLockBusy(busy)).toStrictEqual({ reason: 'held', pid: 7 });
    const ownerless = new Exception('busy', {
      code: FS_ERRORS.LOCK_BUSY,
      data: { path: '/x', reason: 'ownerless' },
    });
    expect(readLockBusy(ownerless)).toStrictEqual({ reason: 'ownerless', pid: null });
  });

  test('returns undefined for any other error or an unknown reason', () => {
    expect(readLockBusy(new Error('x'))).toBeUndefined();
    expect(
      readLockBusy(new Exception('x', { code: FS_ERRORS.LOCK_ACQUISITION_FAILED })),
    ).toBeUndefined();
    expect(readLockBusy(new Exception('x', { code: FS_ERRORS.LOCK_BUSY }))).toBeUndefined();
    expect(
      readLockBusy(new Exception('x', { code: FS_ERRORS.LOCK_BUSY, data: ['held'] })),
    ).toBeUndefined();
    expect(
      readLockBusy(new Exception('x', { code: FS_ERRORS.LOCK_BUSY, data: { reason: 'odd' } })),
    ).toBeUndefined();
  });
});

describe('judgeLock', () => {
  test('judges in jg-fs order: recovery, ownerless, other host, held, unexpected entries, gone', () => {
    expect(judgeLock(['owner.json', 'recovery'], OWNER, true, false)).toBe('recovery-in-progress');
    expect(judgeLock([], null, false, null)).toBe('ownerless');
    expect(judgeLock(['owner.json'], OWNER, false, null)).toBe('other-host');
    expect(judgeLock(['owner.json', 'extra'], OWNER, true, true)).toBe('held');
    expect(judgeLock(['owner.json'], OWNER, true, null)).toBe('held');
    expect(judgeLock(['owner.json', 'extra'], OWNER, true, false)).toBe('unexpected-entries');
    expect(judgeLock(['owner.json'], OWNER, true, false)).toBe('owner-gone');
  });
});

describe('readProgramName', () => {
  test('names the entry script without its folder, or the executable without one', () => {
    expect(readProgramName('/srv/app/scripts/dev.js', '/usr/bin/node')).toBe('dev.js');
    expect(readProgramName(undefined, '/usr/bin/node')).toBe('node');
    expect(readProgramName('', '/usr/bin/node')).toBe('node');
  });
});

describe('owner metadata', () => {
  test("writes jg-locks' fields over the caller's, and reads them back apart", () => {
    const metadata = buildOwnerMetadata(
      { runId: 'run-1', program: 'spoofed' },
      'dev.js',
      '/srv/app',
      '2026-10-29T12:00:00.000Z',
    );
    expect(metadata).toStrictEqual({
      runId: 'run-1',
      program: 'dev.js',
      cwd: '/srv/app',
      startedAt: '2026-10-29T12:00:00.000Z',
    });
    expect(
      toLockOwner({ pid: 4242, nonce: 'nonce-1', hostname: 'laptop', metadata }),
    ).toStrictEqual(OWNER);
  });

  test('reads an owner another tool wrote, without jg-locks fields', () => {
    expect(toLockOwner({ pid: 1, nonce: 'n', hostname: 'h' })).toStrictEqual({
      pid: 1,
      nonce: 'n',
      hostname: 'h',
      program: null,
      cwd: null,
      startedAt: null,
      metadata: {},
    });
  });

  test('turns an owner back into the jg-fs owner a takeover names', () => {
    expect(toFileLockOwner(OWNER)).toStrictEqual({
      pid: 4242,
      nonce: 'nonce-1',
      hostname: 'laptop',
    });
  });
});
