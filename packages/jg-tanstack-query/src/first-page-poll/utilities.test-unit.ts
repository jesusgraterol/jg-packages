import type { InfiniteData } from '@tanstack/react-query';
import { describe, expect, test } from 'vitest';

import { mergeFirstPage } from './utilities.js';

type IEvent = { id: string; title: string };
type IEventPage = { data: IEvent[]; nextCursor: string | null };

const getEventId = (event: IEvent): string => event.id;

// a list that loaded two pages: b and a first, then z
const LOADED: InfiniteData<IEventPage, string | null> = {
  pages: [
    {
      data: [
        { id: 'b', title: 'B' },
        { id: 'a', title: 'A' },
      ],
      nextCursor: 'cursor-1',
    },
    { data: [{ id: 'z', title: 'Z' }], nextCursor: null },
  ],
  pageParams: [null, 'cursor-1'],
};

describe('mergeFirstPage', () => {
  test('puts new rows ahead, updates held rows on any page, and keeps the later pages and their params', () => {
    const latest: IEventPage = {
      data: [
        { id: 'c', title: 'C' },
        { id: 'b', title: 'B, edited' },
        { id: 'z', title: 'Z, edited' },
      ],
      nextCursor: 'cursor-2',
    };

    expect(mergeFirstPage(LOADED, latest, getEventId)).toStrictEqual({
      pages: [
        {
          data: [
            { id: 'c', title: 'C' },
            { id: 'b', title: 'B, edited' },
            { id: 'a', title: 'A' },
          ],
          nextCursor: 'cursor-1',
        },
        { data: [{ id: 'z', title: 'Z, edited' }], nextCursor: null },
      ],
      pageParams: [null, 'cursor-1'],
    });
  });

  test('changes nothing more when the same page is merged twice', () => {
    const latest: IEventPage = { data: [{ id: 'c', title: 'C' }], nextCursor: 'cursor-2' };
    const once = mergeFirstPage(LOADED, latest, getEventId);

    expect(mergeFirstPage(once, latest, getEventId)).toStrictEqual(once);
  });

  test('keeps every loaded row when the first page reads empty', () => {
    expect(mergeFirstPage(LOADED, { data: [], nextCursor: null }, getEventId)).toStrictEqual(
      LOADED,
    );
  });

  test('returns the loaded pages as they are when there are none', () => {
    const empty: InfiniteData<IEventPage, string | null> = { pages: [], pageParams: [] };

    expect(
      mergeFirstPage(empty, { data: [{ id: 'c', title: 'C' }], nextCursor: null }, getEventId),
    ).toBe(empty);
  });

  test('leaves the loaded pages unchanged', () => {
    const before = structuredClone(LOADED);

    mergeFirstPage(
      LOADED,
      { data: [{ id: 'a', title: 'A, edited' }], nextCursor: null },
      getEventId,
    );

    expect(LOADED).toStrictEqual(before);
  });
});
