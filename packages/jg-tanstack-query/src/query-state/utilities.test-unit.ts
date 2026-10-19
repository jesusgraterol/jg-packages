// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IQueryExecutionState, IQueryInitialResolutionState } from './types.js';
import {
  canQueryLoadMore,
  isQueryLoading,
  isQueryLoadingMore,
  isQueryReadyForInitialDisplay,
  isQueryResultDataAvailable,
} from './utilities.js';

describe('isQueryReadyForInitialDisplay', () => {
  test.each<[IQueryInitialResolutionState, boolean]>([
    [{ isError: false, isFetchedAfterMount: false, isStale: false }, true],
    [{ isError: false, isFetchedAfterMount: true, isStale: true }, true],
    [{ isError: false, isFetchedAfterMount: false, isStale: true }, false],
    [{ isError: true, isFetchedAfterMount: true, isStale: true }, false],
  ])('isQueryReadyForInitialDisplay(%o) -> %s', (query, expected) => {
    expect(isQueryReadyForInitialDisplay(query)).toBe(expected);
  });
});

describe('isQueryLoading', () => {
  test.each<[IQueryExecutionState, boolean]>([
    [{ isError: false }, false],
    [{ isError: false, isLoading: true }, true],
    [{ isError: false, isPending: true }, true],
    [{ isError: true, isLoading: false, isPending: false }, false],
  ])('isQueryLoading(%o) -> %s', (query, expected) => {
    expect(isQueryLoading(query)).toBe(expected);
  });
});

describe('canQueryLoadMore', () => {
  test.each<[IQueryExecutionState, boolean]>([
    [{ isError: false, hasNextPage: true }, true],
    [{ isError: false, hasNextPage: false }, false],
    [{ isError: false }, false],
    [{ isError: true, hasNextPage: true }, false],
  ])('canQueryLoadMore(%o) -> %s', (query, expected) => {
    expect(canQueryLoadMore(query)).toBe(expected);
  });
});

describe('isQueryLoadingMore', () => {
  test.each<[IQueryExecutionState, boolean]>([
    [{ isError: false, isFetchingNextPage: true }, true],
    [{ isError: false, isFetchingNextPage: false }, false],
    [{ isError: false }, false],
  ])('isQueryLoadingMore(%o) -> %s', (query, expected) => {
    expect(isQueryLoadingMore(query)).toBe(expected);
  });
});

describe('isQueryResultDataAvailable', () => {
  test.each<[IQueryExecutionState[], boolean]>([
    [[], true],
    [[{ isError: false }, { isError: false, isLoading: false, isPending: false }], true],
    [[{ isError: false }, { isError: true }], false],
    [[{ isError: false, isPending: true }], false],
    [[{ isError: false, isLoading: true }], false],
    // a next page in flight keeps the pages already loaded on screen
    [[{ isError: false, isFetchingNextPage: true }], true],
  ])('isQueryResultDataAvailable(%o) -> %s', (queries, expected) => {
    expect(isQueryResultDataAvailable(queries)).toBe(expected);
  });
});
