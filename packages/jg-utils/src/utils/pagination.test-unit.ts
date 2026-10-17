// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { getNextPageParam } from './pagination.js';

describe('getNextPageParam', () => {
  test('returns undefined when the array is empty', () => {
    const emptyEntries: Array<{ id: string }> = [];

    expect(getNextPageParam('id', emptyEntries, 1)).toBeUndefined();
  });

  test('returns undefined when the array length is below the page size', () => {
    const entries = [
      { id: 'entry-1', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'entry-2', createdAt: new Date('2026-01-02T00:00:00.000Z') },
    ];

    expect(getNextPageParam('id', entries, 3)).toBeUndefined();
  });

  test.each(<Array<[string, number]>>[
    ['equal to', 2],
    ['greater than', 1],
  ])(
    'returns the requested property value when the array length is %s the page size',
    (_, pageSize) => {
      const entries = [
        { id: 'entry-1', createdAt: new Date('2026-01-01T00:00:00.000Z') },
        { id: 'entry-2', createdAt: new Date('2026-01-02T00:00:00.000Z') },
      ];

      const lastEntryId: string | undefined = getNextPageParam('id', entries, pageSize);
      const lastEntryCreatedAt: Date | undefined = getNextPageParam('createdAt', entries, pageSize);

      expect(lastEntryId).toBe('entry-2');
      expect(lastEntryCreatedAt).toStrictEqual(new Date('2026-01-02T00:00:00.000Z'));
    },
  );
});
