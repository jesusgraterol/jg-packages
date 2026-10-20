// @vitest-environment node
import * as fs from 'node:fs';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { assertNoLinksBelow } from './general.js';

// keeps the real filesystem, while letting a test make lstatSync fail
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, lstatSync: vi.fn(actual.lstatSync) };
});

afterEach(() => {
  vi.mocked(fs.lstatSync).mockReset();
});

describe('assertNoLinksBelow failures', () => {
  test('passes on an error reading a directory, other than a missing one', () => {
    const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    vi.mocked(fs.lstatSync).mockImplementationOnce(() => {
      throw denied;
    });

    expect(() => assertNoLinksBelow('/repo', '/repo/docs/file.md')).toThrow(denied);
  });
});
