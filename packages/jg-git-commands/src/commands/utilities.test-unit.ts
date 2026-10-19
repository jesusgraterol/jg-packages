// @vitest-environment node
import { getErrorCode } from 'jg-exception';
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import {
  isRefName,
  isRepositoryPathValid,
  isRevisionValid,
  parseRemoteRefs,
  parseStatus,
  readSuccessfulOutput,
} from './utilities.js';

const DEVELOPMENT = 'a'.repeat(40);
const STAGING = 'b'.repeat(40);
const PRODUCTION = 'c'.repeat(40);
const BRANCHES = ['refs/heads/development', 'refs/heads/staging', 'refs/heads/production'];

describe('parseRemoteRefs', () => {
  test('reads the three branches asked for', () => {
    const output = [
      `${DEVELOPMENT}\trefs/heads/development`,
      `${STAGING}\trefs/heads/staging`,
      `${PRODUCTION}\trefs/heads/production`,
    ].join('\n');

    expect(parseRemoteRefs(`${output}\n`, BRANCHES)).toStrictEqual(
      new Map([
        ['refs/heads/development', DEVELOPMENT],
        ['refs/heads/staging', STAGING],
        ['refs/heads/production', PRODUCTION],
      ]),
    );
  });

  test('leaves out a branch the remote does not have', () => {
    expect(parseRemoteRefs(`${DEVELOPMENT}\trefs/heads/development\n`, BRANCHES)).toStrictEqual(
      new Map([['refs/heads/development', DEVELOPMENT]]),
    );
  });

  test('gives a branch that moved its new object ID, for the caller to compare', () => {
    const refs = parseRemoteRefs(`${'d'.repeat(40)}\trefs/heads/staging\n`, BRANCHES);

    expect(refs.get('refs/heads/staging')).not.toBe(STAGING);
  });

  test('reads empty output as no refs', () => {
    expect(parseRemoteRefs('', BRANCHES)).toStrictEqual(new Map());
  });

  test('leaves out refs not asked for, which tail matching can list', () => {
    const output = `${DEVELOPMENT}\trefs/remotes/fork/refs/heads/development\n${STAGING}\trefs/heads/staging\n`;

    expect(parseRemoteRefs(output, BRANCHES)).toStrictEqual(
      new Map([['refs/heads/staging', STAGING]]),
    );
  });

  test('reads SHA-256 object IDs', () => {
    const objectId = 'e'.repeat(64);

    expect(parseRemoteRefs(`${objectId}\trefs/heads/staging\n`, BRANCHES)).toStrictEqual(
      new Map([['refs/heads/staging', objectId]]),
    );
  });

  test.each([
    ['an abbreviated object ID', `${'a'.repeat(39)}\trefs/heads/development`],
    ['an uppercase object ID', `${'A'.repeat(40)}\trefs/heads/development`],
    ['a space for a tab', `${DEVELOPMENT} refs/heads/development`],
    ['a line without a ref', DEVELOPMENT],
    ['a ref outside refs/', `${DEVELOPMENT}\tHEAD`],
    ['an extra field', `${DEVELOPMENT}\trefs/heads/development\textra`],
  ])('rejects %s', (_description, line) => {
    expectToThrowCode(() => parseRemoteRefs(`${line}\n`, BRANCHES), ERRORS.GIT_OUTPUT_INVALID);
  });
});

describe('parseStatus', () => {
  test('reads empty output as a clean working tree', () => {
    expect(parseStatus('')).toStrictEqual([]);
  });

  test('reads changes, renames with their original path, and untracked paths', () => {
    const output = [
      ' M src/index.ts',
      'R  docs/new name.md',
      'docs/old name.md',
      'A  added.ts',
      'RM moved.ts',
      'original.ts',
      '?? notes/',
      '',
    ].join('\0');

    expect(parseStatus(output)).toStrictEqual([
      { index: ' ', workingTree: 'M', path: 'src/index.ts', originalPath: null },
      { index: 'R', workingTree: ' ', path: 'docs/new name.md', originalPath: 'docs/old name.md' },
      { index: 'A', workingTree: ' ', path: 'added.ts', originalPath: null },
      { index: 'R', workingTree: 'M', path: 'moved.ts', originalPath: 'original.ts' },
      { index: '?', workingTree: '?', path: 'notes/', originalPath: null },
    ]);
  });

  test('reads a copy and a rename in the working tree', () => {
    expect(
      parseStatus(['C  copy.ts', 'source.ts', ' R renamed.ts', 'before.ts', ''].join('\0')),
    ).toStrictEqual([
      { index: 'C', workingTree: ' ', path: 'copy.ts', originalPath: 'source.ts' },
      { index: ' ', workingTree: 'R', path: 'renamed.ts', originalPath: 'before.ts' },
    ]);
  });

  test.each([
    ['output that does not end its last record', ' M src/index.ts'],
    ['a record too short to hold a path', ' M \0'],
    ['a record without the space after its status', ' MXsrc/index.ts\0'],
    ['a rename without its original path', 'R  new.ts\0'],
    ['a rename with an empty original path', 'R  new.ts\0\0'],
  ])('rejects %s', (_description, output) => {
    expectToThrowCode(() => parseStatus(output), ERRORS.GIT_OUTPUT_INVALID);
  });
});

describe('readSuccessfulOutput', () => {
  const result = { stdout: 'out', stderr: 'https://user:token@example.com', durationMs: 1 };

  test('gives the stdout of a command that exited with 0', () => {
    expect(readSuccessfulOutput({ ...result, exitCode: 0, signalCode: null }, 'status')).toBe(
      'out',
    );
  });

  test.each([
    [128, null],
    [null, 'SIGTERM'],
  ] as const)('throws without stderr for exit code %s', (exitCode, signalCode) => {
    let error: unknown;
    try {
      readSuccessfulOutput({ ...result, exitCode, signalCode }, 'fetch');
    } catch (caught) {
      error = caught;
    }

    expect(getErrorCode(error)).toBe(ERRORS.GIT_COMMAND_FAILED);
    expect(error).toMatchObject({ data: { subcommand: 'fetch', exitCode } });
    expect(JSON.stringify(error)).not.toContain('token');
  });
});

describe('argument checks', () => {
  test.each([
    ['refs/heads/main', true],
    ['refs/tags/v1.0.0', true],
    ['heads/main', false],
    ['main', false],
    ['refs/heads/with space', false],
    ['refs/heads/\0', false],
    ['', false],
    [42, false],
  ])('isRefName(%o) -> %s', (value, expected) => {
    expect(isRefName(value)).toBe(expected);
  });

  test.each([
    ['HEAD', true],
    ['a'.repeat(40), true],
    ['v1.0.0~2', true],
    ['HEAD:README.md', false],
    [':/fix', false],
    ['', false],
    ['HEAD\0', false],
    [undefined, false],
  ])('isRevisionValid(%o) -> %s', (value, expected) => {
    expect(isRevisionValid(value)).toBe(expected);
  });

  test.each([
    ['package.json', true],
    ['src/index.ts', true],
    ['.github/workflows/ci.yml', true],
    ['/etc/passwd', false],
    ['../outside', false],
    ['src/../package.json', false],
    ['./package.json', false],
    ['src//index.ts', false],
    ['src/', false],
    ['src\\index.ts', false],
    ['src/\0', false],
    ['', false],
    [null, false],
  ])('isRepositoryPathValid(%o) -> %s', (value, expected) => {
    expect(isRepositoryPathValid(value)).toBe(expected);
  });
});
