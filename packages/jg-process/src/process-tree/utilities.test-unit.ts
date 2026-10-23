import { describe, expect, test } from 'vitest';

import type { IWindowsProcess } from './types.js';
import { findWindowsDescendants, parseWindowsProcessList } from './utilities.js';

describe('parseWindowsProcessList', () => {
  test('reads each line as a process, with a start past the safe integer range kept exact', () => {
    const output = '0 0 0\r\n  4120 900 134062848000000001  \r\n4188 4120 134062848000000002\r\n';

    expect(parseWindowsProcessList(output)).toStrictEqual([
      { pid: 0, parentPid: 0, createdAt: 0n },
      { pid: 4120, parentPid: 900, createdAt: 134062848000000001n },
      { pid: 4188, parentPid: 4120, createdAt: 134062848000000002n },
    ]);
  });

  test('skips lines that are not a process, such as a warning or a blank line', () => {
    const output =
      'WARNING: something\r\n\r\n4120 900\r\n4120 900 12 7\r\n-4 900 12\r\n4188 4120 13\n';

    expect(parseWindowsProcessList(output)).toStrictEqual([
      { pid: 4188, parentPid: 4120, createdAt: 13n },
    ]);
  });

  test('reads no processes from empty output', () => {
    expect(parseWindowsProcessList('')).toStrictEqual([]);
  });
});

describe('findWindowsDescendants', () => {
  // a tree under 100: 100 > 104 > 108 > 112, and 100 > 116, beside an unrelated 200 > 204
  const TREE: IWindowsProcess[] = [
    { pid: 0, parentPid: 0, createdAt: 0n },
    { pid: 100, parentPid: 4, createdAt: 1_000n },
    { pid: 104, parentPid: 100, createdAt: 1_001n },
    { pid: 108, parentPid: 104, createdAt: 1_002n },
    { pid: 112, parentPid: 108, createdAt: 1_003n },
    { pid: 116, parentPid: 100, createdAt: 1_004n },
    { pid: 200, parentPid: 4, createdAt: 900n },
    { pid: 204, parentPid: 200, createdAt: 950n },
  ];

  test('finds every level of descendants, nearest first', () => {
    expect(findWindowsDescendants(TREE, 100)).toStrictEqual([104, 116, 108, 112]);
  });

  test('leaves out a process that started before the parent its parent id now names', () => {
    // 120's parent was an earlier process with id 100, which exited before this 100 started
    const processes = [...TREE, { pid: 120, parentPid: 100, createdAt: 500n }];

    expect(findWindowsDescendants(processes, 100)).toStrictEqual([104, 116, 108, 112]);
  });

  test('counts a child that started in the same tick as its parent', () => {
    const processes = [...TREE, { pid: 124, parentPid: 116, createdAt: 1_004n }];

    expect(findWindowsDescendants(processes, 100)).toStrictEqual([104, 116, 108, 124, 112]);
  });

  test('finds no descendants for a process without children, or one not in the snapshot', () => {
    expect(findWindowsDescendants(TREE, 112)).toStrictEqual([]);
    expect(findWindowsDescendants(TREE, 300)).toStrictEqual([]);
  });

  test('ends on a process listed as its own parent, as Windows lists the idle process', () => {
    expect(findWindowsDescendants(TREE, 0)).toStrictEqual([]);
  });
});
