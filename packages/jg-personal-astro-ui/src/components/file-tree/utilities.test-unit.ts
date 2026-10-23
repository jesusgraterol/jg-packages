import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

import type { IFileTreeEntry } from '../../contracts/index.ts';

import { MAX_FILE_TREE_DEPTH, MAX_FILE_TREE_ENTRIES } from './constants.ts';
import { buildFileTreePreview } from './utilities.ts';

const file = (name: string): IFileTreeEntry => ({ kind: 'file', name });
const directory = (name: string, children: IFileTreeEntry[]): IFileTreeEntry => ({
  kind: 'directory',
  name,
  children,
});
const names = (entries: readonly IFileTreeEntry[]): string[] =>
  entries.flatMap((entry) => [
    entry.name,
    ...(entry.kind === 'directory' ? names(entry.children) : []),
  ]);

test('empty input and empty directories are complete previews', () => {
  expect(buildFileTreePreview([])).toStrictEqual({ entries: [], isPartial: false });
  const result = buildFileTreePreview([directory('empty', [])]);
  expect(result.isPartial).toBe(false);
  expect(names(result.entries)).toStrictEqual(['empty']);
});

test('retains caller labels, links, statuses, order, and nested structure without mutation', () => {
  const source: IFileTreeEntry[] = [
    {
      kind: 'directory',
      name: 'src',
      href: '#source',
      status: 'modified',
      children: [{ kind: 'file', name: '世界 <file>.ts', href: '#file', status: 'added' }],
    },
    { kind: 'file', name: 'removed.ts', status: 'removed' },
    { kind: 'file', name: 'stable.ts', status: 'unchanged' },
  ];
  const before = structuredClone(source);
  const result = buildFileTreePreview(source);
  expect(result.isPartial).toBe(false);
  expect(result.entries).toStrictEqual([
    {
      kind: 'directory',
      name: 'src',
      href: '#source',
      status: 'modified',
      children: [{ kind: 'file', name: '世界 <file>.ts', href: '#file', status: 'added' }],
    },
    { kind: 'file', name: 'removed.ts', href: undefined, status: 'removed' },
    { kind: 'file', name: 'stable.ts', href: undefined, status: 'unchanged' },
  ]);
  expect(source).toStrictEqual(before);
  expect(result.entries[0]).not.toBe(source[0]);
});

test.each([255, 256, 257])('a wide input of %d entries reports only actual omissions', (length) => {
  const result = buildFileTreePreview(Array.from({ length }, (_, index) => file(`file-${index}`)));
  expect(result.entries).toHaveLength(Math.min(length, 256));
  expect(result.isPartial).toBe(length > 256);
});

test('stops before reading omitted entries of a large input', () => {
  const source = Array.from({ length: 256 }, (_, index) => file(`file-${index}`));
  source.length = 1_000_000;
  Object.defineProperty(source, 256, {
    get: () => {
      throw new Error('Omitted entries must not be read.');
    },
  });
  const result = buildFileTreePreview(source);
  expect(result.entries).toHaveLength(256);
  expect(result.isPartial).toBe(true);
});

test('shares one budget across branches without reading later siblings', () => {
  const source = [
    directory(
      'root',
      Array.from({ length: 255 }, (_, index) => file(`child-${index}`)),
    ),
  ];
  Object.defineProperty(source, 1, {
    get: () => {
      throw new Error('Later siblings must not be read.');
    },
  });
  const result = buildFileTreePreview(source);
  expect(names(result.entries)).toHaveLength(256);
  expect(result.isPartial).toBe(true);
  const exact = buildFileTreePreview([
    directory(
      'root',
      Array.from({ length: 255 }, (_, index) => file(`child-${index}`)),
    ),
  ]);
  expect(exact.isPartial).toBe(false);
});

test('does not read descendants once a directory fills the remaining entry budget', () => {
  const children: IFileTreeEntry[] = [];
  Object.defineProperty(children, 0, {
    get: () => {
      throw new Error('Descendants beyond the budget must not be read.');
    },
  });
  const result = buildFileTreePreview([
    ...Array.from({ length: 255 }, (_, index) => file(`file-${index}`)),
    directory('last-directory', children),
  ]);
  expect(names(result.entries)).toHaveLength(256);
  expect(result.isPartial).toBe(true);
});

test('limits a very deep input to eight levels without descending farther', () => {
  let root = file('leaf');
  for (let level = 1024; level >= 1; level--) root = directory(`directory-${level}`, [root]);
  const result = buildFileTreePreview([root]);
  expect(names(result.entries)).toStrictEqual([
    'directory-1',
    'directory-2',
    'directory-3',
    'directory-4',
    'directory-5',
    'directory-6',
    'directory-7',
    'directory-8',
  ]);
  expect(result.isPartial).toBe(true);
});

test('exactly eight levels and an empty directory at the limit remain complete', () => {
  let leaf = file('leaf');
  let empty = directory('empty', []);
  for (let level = 7; level >= 1; level--) {
    leaf = directory(`directory-${level}`, [leaf]);
    empty = directory(`directory-${level}`, [empty]);
  }
  expect(names(buildFileTreePreview([leaf]).entries)).toHaveLength(8);
  expect(buildFileTreePreview([leaf]).isPartial).toBe(false);
  expect(buildFileTreePreview([empty]).isPartial).toBe(false);
});

test('cuts direct and indirect ancestor cycles while retaining following entries', () => {
  const direct = directory('loop', []);
  if (direct.kind !== 'directory') throw new Error('Fixture is not a directory.');
  direct.children = [direct, file('following')];
  const result = buildFileTreePreview([direct]);
  expect(names(result.entries)).toStrictEqual(['loop', 'loop', 'following']);
  expect(result.isPartial).toBe(true);
  const parent = directory('parent', []);
  if (parent.kind !== 'directory') throw new Error('Fixture is not a directory.');
  parent.children = [directory('child', [parent])];
  const indirect = buildFileTreePreview([parent]);
  expect(names(indirect.entries)).toStrictEqual(['parent', 'child', 'parent']);
  expect(indirect.isPartial).toBe(true);
});

test('a shared directory in separate branches is not an ancestor cycle', () => {
  const shared = directory('shared', [file('leaf')]);
  const result = buildFileTreePreview([
    directory('first', [shared]),
    directory('second', [shared]),
  ]);
  expect(names(result.entries)).toStrictEqual([
    'first',
    'shared',
    'leaf',
    'second',
    'shared',
    'leaf',
  ]);
  expect(result.isPartial).toBe(false);
});

test('the documented preview bounds match the implementation', () => {
  const guide = readFileSync(
    new URL('../../../../../docs/personal-astro-ui.md', import.meta.url),
    'utf8',
  );
  expect(guide).toContain(
    `at most ${MAX_FILE_TREE_ENTRIES} entries and ${MAX_FILE_TREE_DEPTH} levels`,
  );
});
