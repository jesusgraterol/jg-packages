// @vitest-environment node
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expectToThrowCode } from 'jg-exception/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { catchError, expectNoValue } from '../shared/leak.test-utils.js';
import { readEnvFile } from './env-file.js';

// a value that must never show in an error
const SECRET = 'hunter2-very-secret-value';

const IS_POSIX = process.platform !== 'win32';

let directory: string;

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'jg-env-files-'));
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

/**
 * Writes a file in the test's directory.
 * @param name The file's name.
 * @param content The file's bytes or text.
 * @param mode The file's permissions.
 * @returns The file's path.
 */
const writeEnvFile = (name: string, content: string | Uint8Array, mode = 0o600): string => {
  const path = join(directory, name);
  writeFileSync(path, content, { mode });
  chmodSync(path, mode);
  return path;
};

describe('readEnvFile', () => {
  test('reads quotes, multiline values, export, and comments, with a later key winning', () => {
    const path = writeEnvFile(
      'syntax.env',
      [
        '# the database',
        'DATABASE_HOST=localhost',
        'export DATABASE_PORT=5432',
        'GREETING="hello world"',
        "LITERAL='${DATABASE_HOST}'",
        'CERTIFICATE="line one',
        'line two"',
        'DATABASE_HOST=db.internal # the later value wins',
        'NOT_A_VARIABLE',
        '',
      ].join('\n'),
    );

    expect(readEnvFile(path)).toStrictEqual({
      DATABASE_HOST: 'db.internal',
      DATABASE_PORT: '5432',
      GREETING: 'hello world',
      LITERAL: '${DATABASE_HOST}',
      CERTIFICATE: 'line one\nline two',
    });
  });

  test('reads CRLF line endings and a byte-order mark', () => {
    const path = writeEnvFile('windows.env', '﻿FIRST=1\r\nSECOND=2\r\n');

    expect(readEnvFile(path)).toStrictEqual({ FIRST: '1', SECOND: '2' });
  });

  test('reads an empty file as no variables', () => {
    expect(readEnvFile(writeEnvFile('empty.env', ''))).toStrictEqual({});
  });

  test('never sets a prototype from a __proto__ key', () => {
    const variables = readEnvFile(writeEnvFile('proto.env', '__proto__=polluted\nSAFE=1\n'));

    expect(Object.getPrototypeOf(variables)).toBe(Object.prototype);
    expect(variables).toStrictEqual({ SAFE: '1' });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  test('leaves process.env as it was', () => {
    const before = { ...process.env };

    readEnvFile(writeEnvFile('untouched.env', 'JG_ENV_FILE_TEST_VARIABLE=1\n'));

    expect({ ...process.env }).toStrictEqual(before);
  });

  test('throws ENV_FILE_TOO_LARGE past maxBytes, without the contents', () => {
    const path = writeEnvFile('large.env', `SECRET=${SECRET}\n`);

    const error = catchError(() => readEnvFile(path, { maxBytes: 16 }));

    expect(error).toMatchObject({ code: ERRORS.ENV_FILE_TOO_LARGE, data: { path } });
    expectNoValue(error, SECRET);
    expect(readEnvFile(path, { maxBytes: 64 })).toStrictEqual({ SECRET });
  });

  test('throws ENV_FILE_INVALID for bytes that are not UTF-8, without the contents or a cause', () => {
    const path = writeEnvFile(
      'binary.env',
      Buffer.concat([Buffer.from(`SECRET=${SECRET}\nBROKEN=`), Buffer.from([0xff, 0xfe, 0x0a])]),
    );

    const error = catchError(() => readEnvFile(path));

    expect(error).toMatchObject({
      code: ERRORS.ENV_FILE_INVALID,
      message: `The environment file at ${path} isn't valid UTF-8 text.`,
    });
    expect((error as Error).cause).toBeUndefined();
    expectNoValue(error, SECRET);
  });

  test('throws ENV_FILE_UNREADABLE for a missing file, and reads one as {} with isOptional', () => {
    const path = join(directory, 'missing.env');

    expectToThrowCode(() => readEnvFile(path), ERRORS.ENV_FILE_UNREADABLE);
    expect(readEnvFile(path, { isOptional: true })).toStrictEqual({});
    expect(readEnvFile(path, { isOptional: true, requirePrivate: true })).toStrictEqual({});
  });

  test('treats a missing rootPath as a missing file: ENV_FILE_UNREADABLE, or {} with isOptional', () => {
    const rootPath = join(directory, 'missing-root');
    const path = join(rootPath, 'secrets.env');

    const error = catchError(() => readEnvFile(path, { requirePrivate: true, rootPath }));

    expect(error).toMatchObject({ code: ERRORS.ENV_FILE_UNREADABLE, data: { path } });
    expect(readEnvFile(path, { requirePrivate: true, rootPath, isOptional: true })).toStrictEqual(
      {},
    );
  });

  test('throws ENV_FILE_NOT_PRIVATE for a rootPath that is a file, even with isOptional', () => {
    const rootPath = writeEnvFile('root-file.env', 'A=1\n');

    for (const isOptional of [false, true]) {
      expectToThrowCode(
        () =>
          readEnvFile(join(rootPath, 'secrets.env'), {
            requirePrivate: true,
            rootPath,
            isOptional,
          }),
        ERRORS.ENV_FILE_NOT_PRIVATE,
      );
    }
  });

  test('still throws for an optional file that exists but cannot be read', () => {
    const path = writeEnvFile('optional-large.env', `SECRET=${SECRET}\n`);

    expectToThrowCode(
      () => readEnvFile(path, { isOptional: true, maxBytes: 8 }),
      ERRORS.ENV_FILE_TOO_LARGE,
    );
  });

  test('throws ENV_FILE_UNREADABLE for a directory', () => {
    const path = mkdtempSync(join(directory, 'a-directory-'));

    expectToThrowCode(() => readEnvFile(path), ERRORS.ENV_FILE_UNREADABLE);
  });

  describe.skipIf(!IS_POSIX)('on POSIX', () => {
    test('reads a private file with requirePrivate', () => {
      const path = writeEnvFile('private.env', `SECRET=${SECRET}\n`, 0o600);

      expect(readEnvFile(path, { requirePrivate: true, rootPath: directory })).toStrictEqual({
        SECRET,
      });
    });

    test('throws ENV_FILE_NOT_PRIVATE for a file others can read, without the contents', () => {
      const path = writeEnvFile('shared.env', `SECRET=${SECRET}\n`, 0o644);

      const error = catchError(() => readEnvFile(path, { requirePrivate: true }));

      expect(error).toMatchObject({ code: ERRORS.ENV_FILE_NOT_PRIVATE, data: { path } });
      expectNoValue(error, SECRET);
      // without requirePrivate, the same file reads
      expect(readEnvFile(path)).toStrictEqual({ SECRET });
    });

    test('throws ENV_FILE_NOT_PRIVATE for a private file outside its root', () => {
      const path = writeEnvFile('outside.env', 'A=1\n');
      const root = mkdtempSync(join(directory, 'root-'));

      expectToThrowCode(
        () => readEnvFile(path, { requirePrivate: true, rootPath: root }),
        ERRORS.ENV_FILE_NOT_PRIVATE,
      );
    });

    test('refuses a symbolic link to a file, with or without requirePrivate', () => {
      const target = writeEnvFile('target.env', `SECRET=${SECRET}\n`);
      const link = join(mkdtempSync(join(directory, 'link-')), 'link.env');
      symlinkSync(target, link);

      for (const options of [{}, { requirePrivate: true }]) {
        const error = catchError(() => readEnvFile(link, options));
        expect(error).toMatchObject({ code: ERRORS.ENV_FILE_UNREADABLE });
        expectNoValue(error, SECRET);
      }
    });

    test('throws ENV_FILE_NOT_PRIVATE for a private file reached through a linked directory', () => {
      const caseDirectory = mkdtempSync(join(directory, 'linked-directory-'));
      const real = join(caseDirectory, 'real');
      mkdirSync(real);
      writeFileSync(join(real, 'secrets.env'), 'A=1\n', { mode: 0o600 });
      const linked = join(caseDirectory, 'linked');
      symlinkSync(real, linked);

      expectToThrowCode(
        () => readEnvFile(join(linked, 'secrets.env'), { requirePrivate: true }),
        ERRORS.ENV_FILE_NOT_PRIVATE,
      );
    });
  });
});
