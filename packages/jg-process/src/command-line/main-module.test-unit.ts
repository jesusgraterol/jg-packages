// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';

import { isMainModule } from './main-module.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isMainModule without an entry script', () => {
  test.each([[undefined], ['']])('is false when process.argv[1] is %j', (entry) => {
    vi.spyOn(process, 'argv', 'get').mockReturnValue(
      entry === undefined ? [process.execPath] : [process.execPath, entry],
    );

    expect(isMainModule(import.meta.url)).toBe(false);
  });
});
