// @vitest-environment node
import { getErrorCode } from 'jg-exception';
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import {
  decodeRecords,
  isRefName,
  isRepositoryPathValid,
  isRevisionValid,
  parseIndexEntries,
  parseRemoteRefs,
  parseStatus,
  readCompleteOutput,
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
  const COMMIT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const HEADERS = [`# branch.oid ${COMMIT}`, '# branch.head main'];
  // the modes and object IDs between the status letters and the path
  const CHANGED = `N... 100644 100644 100644 ${'b'.repeat(40)} ${'c'.repeat(40)}`;

  test('reads the commit, and no entries for a clean working tree', () => {
    expect(parseStatus(HEADERS)).toStrictEqual({ commit: COMMIT, entries: [] });
  });

  test('reads a null commit before the first one', () => {
    expect(parseStatus(['# branch.oid (initial)', '# branch.head main', '? new.ts'])).toStrictEqual(
      {
        commit: null,
        entries: [{ index: '?', workingTree: '?', path: 'new.ts', originalPath: null }],
      },
    );
  });

  test('reads changes, renames and copies with their original paths, conflicts, and untracked files', () => {
    const records = [
      ...HEADERS,
      `1 .M ${CHANGED} src/index.ts`,
      `2 R. ${CHANGED} R100 docs/new name.md`,
      'docs/old name.md',
      `2 .C ${CHANGED} C75 copy.ts`,
      'source.ts',
      `u UU N... 100644 100644 100644 100644 ${'d'.repeat(40)} ${'e'.repeat(40)} ${'f'.repeat(40)} both changed.ts`,
      '? notes/todo.md',
    ];

    expect(parseStatus(records)).toStrictEqual({
      commit: COMMIT,
      entries: [
        { index: ' ', workingTree: 'M', path: 'src/index.ts', originalPath: null },
        {
          index: 'R',
          workingTree: ' ',
          path: 'docs/new name.md',
          originalPath: 'docs/old name.md',
        },
        { index: ' ', workingTree: 'C', path: 'copy.ts', originalPath: 'source.ts' },
        { index: 'U', workingTree: 'U', path: 'both changed.ts', originalPath: null },
        { index: '?', workingTree: '?', path: 'notes/todo.md', originalPath: null },
      ],
    });
  });

  test.each([
    ['records without the commit header', ['? new.ts']],
    ['a commit that is not an object ID', ['# branch.oid main']],
    ['an unknown kind of record', [...HEADERS, '! ignored.ts']],
    ['a changed record without its path', [...HEADERS, `1 .M ${CHANGED}`]],
    ['a record whose status is not two letters', [...HEADERS, `1 M ${CHANGED} a.ts`]],
    ['an untracked record without a path', [...HEADERS, '?']],
    ['a rename without its original path', [...HEADERS, `2 R. ${CHANGED} R100 new.ts`]],
    ['a rename with an empty original path', [...HEADERS, `2 R. ${CHANGED} R100 new.ts`, '']],
  ])('rejects %s', (_description, records) => {
    expectToThrowCode(() => parseStatus(records), ERRORS.GIT_OUTPUT_INVALID);
  });
});

describe('parseIndexEntries', () => {
  test('reads each entry mode, stage, and path', () => {
    expect(
      parseIndexEntries([
        `100644 ${'a'.repeat(40)} 0\tsrc/with space.ts`,
        `120000 ${'b'.repeat(64)} 2\tlink`,
      ]),
    ).toStrictEqual([
      { mode: '100644', stage: 0, path: 'src/with space.ts' },
      { mode: '120000', stage: 2, path: 'link' },
    ]);
  });

  test.each([
    ['a record without a tab', `100644 ${'a'.repeat(40)} 0 file.ts`],
    ['a record without a path', `100644 ${'a'.repeat(40)} 0\t`],
    ['a stage past 3', `100644 ${'a'.repeat(40)} 4\tfile.ts`],
    ['a short object ID', `100644 ${'a'.repeat(12)} 0\tfile.ts`],
  ])('rejects %s', (_description, record) => {
    expectToThrowCode(() => parseIndexEntries([record]), ERRORS.GIT_OUTPUT_INVALID);
  });
});

describe('decodeRecords', () => {
  test('splits NUL-terminated records, and reads empty output as none', () => {
    expect(decodeRecords(Buffer.from('a b\0c\0'), 'ls-files')).toStrictEqual(['a b', 'c']);
    expect(decodeRecords(Buffer.alloc(0), 'ls-files')).toStrictEqual([]);
  });

  test.each([
    ['output whose last record has no NUL', Buffer.from('a\0b')],
    ['bytes that are not valid UTF-8', Buffer.from([0x61, 0xff, 0x00])],
  ])('rejects %s', (_description, output) => {
    expectToThrowCode(() => decodeRecords(output, 'ls-files'), ERRORS.GIT_OUTPUT_INVALID);
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
    [
      'fatal: not a git repository (or any of the parent directories): .git\n',
      ERRORS.GIT_REPOSITORY_NOT_FOUND,
    ],
    ["warning: x\nfatal: not a git repository: '/srv/app'\n", ERRORS.GIT_REPOSITORY_NOT_FOUND],
    ["fatal: detected dubious ownership in repository at '/srv/app'\n", ERRORS.GIT_ACCESS_DENIED],
    ["fatal: could not open '.git/HEAD': Permission denied\r\n", ERRORS.GIT_ACCESS_DENIED],
    [
      'git@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository.\n',
      ERRORS.GIT_COMMAND_FAILED,
    ],
    ['fatal: bad revision\n', ERRORS.GIT_COMMAND_FAILED],
  ])('classifies stderr %j as %s, from a Buffer too', (stderr, code) => {
    for (const output of [stderr, Buffer.from(stderr)]) {
      expectToThrowCode(
        () =>
          readSuccessfulOutput(
            { stdout: '', stderr: output, exitCode: 128, signalCode: null, durationMs: 1 },
            'status',
          ),
        code,
      );
    }
  });

  test('throws GIT_ACCESS_DENIED for a repository Git refuses for its ownership', () => {
    expectToThrowCode(
      () =>
        readSuccessfulOutput(
          {
            stdout: '',
            stderr: "fatal: detected dubious ownership in repository at '/srv/app'\n",
            exitCode: 128,
            signalCode: null,
            durationMs: 1,
          },
          'status',
        ),
      ERRORS.GIT_ACCESS_DENIED,
      "Git can't access the repository.",
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

describe('readCompleteOutput', () => {
  const result = { stdout: Buffer.from('a.txt\0'), signalCode: null, durationMs: 1 };

  test('gives the stdout of a listing that exited with 0 without a warning', () => {
    expect(
      readCompleteOutput({ ...result, stderr: Buffer.alloc(0), exitCode: 0 }, 'ls-files'),
    ).toStrictEqual(Buffer.from('a.txt\0'));
  });

  test('refuses a listing that warned it skipped something, though it exited with 0', () => {
    expectToThrowCode(
      () =>
        readCompleteOutput(
          {
            ...result,
            stderr: Buffer.from("warning: could not open directory 'locked/': Permission denied\n"),
            exitCode: 0,
          },
          'ls-files',
        ),
      ERRORS.GIT_OUTPUT_INVALID,
    );
  });

  test('classifies a listing that failed as readSuccessfulOutput does', () => {
    expectToThrowCode(
      () =>
        readCompleteOutput(
          { ...result, stderr: Buffer.from('fatal: bad revision\n'), exitCode: 128 },
          'ls-files',
        ),
      ERRORS.GIT_COMMAND_FAILED,
    );
  });
});
