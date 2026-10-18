// @vitest-environment node
import * as fs from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { RENAME_RETRY_DELAYS_MS } from '../../shared/index.js';
import { renameReplacing, resolveWriteTarget } from './utilities.js';

// renameSync is a fake, so a test decides each attempt's outcome
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, renameSync: vi.fn(), realpathSync: vi.fn(actual.realpathSync) };
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
  vi.restoreAllMocks();
  vi.mocked(fs.renameSync).mockReset();
});

describe('renameReplacing', () => {
  test('waits and tries again while Windows reports the file busy, then renames it', () => {
    setPlatform('win32');
    const wait = vi.spyOn(Atomics, 'wait').mockReturnValue('timed-out');
    vi.mocked(fs.renameSync)
      .mockImplementationOnce(() => {
        throw systemError('EBUSY');
      })
      .mockImplementationOnce(() => undefined);

    renameReplacing('state.json.tmp', 'state.json');

    expect(fs.renameSync).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledExactlyOnceWith(
      expect.any(Int32Array),
      0,
      0,
      RENAME_RETRY_DELAYS_MS[0],
    );
  });

  test('gives up with the last error once every wait has passed', () => {
    setPlatform('win32');
    const wait = vi.spyOn(Atomics, 'wait').mockReturnValue('timed-out');
    const busy = systemError('EPERM');
    vi.mocked(fs.renameSync).mockImplementation(() => {
      throw busy;
    });

    expect(() => {
      renameReplacing('a.tmp', 'a.json');
    }).toThrow(busy);
    expect(fs.renameSync).toHaveBeenCalledTimes(RENAME_RETRY_DELAYS_MS.length + 1);
    expect(wait.mock.calls.map(([, , , delay]) => delay)).toStrictEqual(RENAME_RETRY_DELAYS_MS);
  });

  test('fails at once for any other error, and for a busy file on another platform', () => {
    const wait = vi.spyOn(Atomics, 'wait');
    setPlatform('win32');
    vi.mocked(fs.renameSync).mockImplementationOnce(() => {
      throw systemError('ENOENT');
    });
    expect(() => {
      renameReplacing('a.tmp', 'a.json');
    }).toThrow('ENOENT');

    setPlatform('darwin');
    vi.mocked(fs.renameSync).mockImplementationOnce(() => {
      throw systemError('EBUSY');
    });
    expect(() => {
      renameReplacing('a.tmp', 'a.json');
    }).toThrow('EBUSY');

    expect(wait).not.toHaveBeenCalled();
  });
});

describe('resolveWriteTarget', () => {
  test('lets an error other than a missing path through', () => {
    const denied = systemError('EACCES');
    vi.mocked(fs.realpathSync).mockImplementationOnce(() => {
      throw denied;
    });

    expect(() => resolveWriteTarget('config.json')).toThrow(denied);
  });
});
