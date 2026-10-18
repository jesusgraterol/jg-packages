import { describe, expect, test } from 'vitest';

import { buildCursorPage } from './cursor.js';

describe('buildCursorPage', () => {
  const toCursor = ({ id }: { id: string }): string => id;

  test('keeps the page size, and points at its last row when another row followed', () => {
    expect(buildCursorPage([{ id: '3' }, { id: '2' }, { id: '1' }], 2, toCursor)).toStrictEqual({
      items: [{ id: '3' }, { id: '2' }],
      nextCursor: '2',
    });
  });

  test.each([
    ['a full last page', [{ id: '2' }, { id: '1' }]],
    ['a short last page', [{ id: '1' }]],
    ['no rows', []],
  ])('has no next cursor for %s', (_, rows) => {
    expect(buildCursorPage(rows, 2, toCursor)).toStrictEqual({ items: rows, nextCursor: null });
  });
});
