// @vitest-environment node
import * as fs from 'node:fs/promises';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { RENAME_RETRY_DELAYS_MS } from '../../shared/index.js';
import { renameReplacing, resolveWriteTarget } from './utilities.js';

// rename is a fake, so a test decides each attempt's outcome
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, rename: vi.fn(), realpath: vi.fn(actual.realpath) };
});

// an error the way Node.js's filesystem reports one
const systemError = (code: string): Error => Object.assign(new Error(code), { code });

// the real platform, which each test restores
const PLATFORM = Object.getOwnPropertyDescriptor(process, 'platform') as PropertyDescriptor;

/**
 * Makes the tests run as if on another platform.
 * @param platform The platform.
 */
const setPlatform = (platform: NodeJS.Platform): void => {
  Object.defineProperty(process, 'platform', { ...PLATFORM, value: platform });
};

afterEach(() => {
  Object.defineProperty(process, 'platform', PLATFORM);
  vi.useRealTimers();
  vi.mocked(fs.rename).mockReset();
});

describe('renameReplacing', () => {
  test('tries again while Windows reports the file busy, then renames it', async () => {
    setPlatform('win32');
    vi.useFakeTimers();
    vi.mocked(fs.rename)
      .mockRejectedValueOnce(systemError('EPERM'))
      .mockRejectedValueOnce(systemError('EBUSY'))
      .mockResolvedValueOnce();

    const renamed = renameReplacing('state.json.tmp', 'state.json');
    await vi.advanceTimersByTimeAsync(
      (RENAME_RETRY_DELAYS_MS[0] ?? 0) + (RENAME_RETRY_DELAYS_MS[1] ?? 0),
    );

    await expect(renamed).resolves.toBeUndefined();
    expect(fs.rename).toHaveBeenCalledTimes(3);
    expect(fs.rename).toHaveBeenLastCalledWith('state.json.tmp', 'state.json');
  });

  test('gives up with the last error once every wait has passed, about 4 seconds', async () => {
    setPlatform('win32');
    vi.useFakeTimers();
    const busy = systemError('EACCES');
    vi.mocked(fs.rename).mockRejectedValue(busy);

    const rejection = expect(renameReplacing('a.tmp', 'a.json')).rejects.toBe(busy);
    await vi.runAllTimersAsync();

    await rejection;
    expect(fs.rename).toHaveBeenCalledTimes(RENAME_RETRY_DELAYS_MS.length + 1);
    expect(RENAME_RETRY_DELAYS_MS.reduce((total, delay) => total + delay, 0)).toBe(4270);
  });

  test('fails at once for any other error, and for a busy file on another platform', async () => {
    setPlatform('win32');
    vi.mocked(fs.rename).mockRejectedValueOnce(systemError('ENOENT'));
    await expect(renameReplacing('a.tmp', 'a.json')).rejects.toMatchObject({ code: 'ENOENT' });

    setPlatform('linux');
    vi.mocked(fs.rename).mockRejectedValueOnce(systemError('EBUSY'));
    await expect(renameReplacing('a.tmp', 'a.json')).rejects.toMatchObject({ code: 'EBUSY' });

    expect(fs.rename).toHaveBeenCalledTimes(2);
  });
});

describe('resolveWriteTarget', () => {
  test('lets an error other than a missing path through', async () => {
    const denied = systemError('EACCES');
    vi.mocked(fs.realpath).mockRejectedValueOnce(denied);

    await expect(resolveWriteTarget('config.json')).rejects.toBe(denied);
  });
});
