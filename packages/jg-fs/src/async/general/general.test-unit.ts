// @vitest-environment node
import * as fs from 'node:fs/promises';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { assertNoLinksBelow } from './general.js';

// keeps the real filesystem, while letting a test make lstat fail
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, lstat: vi.fn(actual.lstat) };
});

afterEach(() => {
  vi.mocked(fs.lstat).mockReset();
});

describe('assertNoLinksBelow failures', () => {
  test('passes on an error reading a directory, other than a missing one', async () => {
    const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    vi.mocked(fs.lstat).mockRejectedValueOnce(denied);

    await expect(assertNoLinksBelow('/repo', '/repo/docs/file.md')).rejects.toBe(denied);
  });
});
