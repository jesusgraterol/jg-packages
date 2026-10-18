import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expectToThrowCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { ERRORS } from '../shared/index.js';
import { catchError, expectNoValue } from '../shared/leak.test-utils.js';
import { createSecretReader } from './secrets.js';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'jg-env-secrets-'));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

describe('outside a container', () => {
  test('reads <KEY>.txt in the secrets directory, byte for byte', async () => {
    await writeFile(join(directory, 'API_KEY.txt'), 'line one\nline two\n');
    const { readSecret } = createSecretReader({
      isRunningInContainer: false,
      secretsDirectoryPath: directory,
    });

    expect(readSecret('API_KEY')).toBe('line one\nline two\n');
  });

  test('names the path of a file that is missing or empty, and keeps the reason as the cause', async () => {
    await writeFile(join(directory, 'EMPTY.txt'), '');
    await mkdir(join(directory, 'FOLDER.txt'));
    const { readSecret } = createSecretReader({
      isRunningInContainer: false,
      secretsDirectoryPath: directory,
    });
    const missing = catchError(() => readSecret('MISSING'));

    expect(missing).toMatchObject({
      code: ERRORS.ENV_SECRET_FILE_UNREADABLE,
      message: `The secret MISSING's file at ${join(directory, 'MISSING.txt')} could not be read.`,
      data: { key: 'MISSING', path: join(directory, 'MISSING.txt') },
    });
    expect((missing as Error).cause).toMatchObject({ code: 'ENOENT' });
    expectToThrowCode(
      () => readSecret('EMPTY'),
      ERRORS.ENV_SECRET_FILE_UNREADABLE,
      `The secret EMPTY's file at ${join(directory, 'EMPTY.txt')} is empty.`,
    );
    expectToThrowCode(() => readSecret('FOLDER'), ERRORS.ENV_SECRET_FILE_UNREADABLE);
  });
});

describe('inside a container', () => {
  test("reads the file at the path the secret's variable holds", async () => {
    const path = join(directory, 'db-password');
    await writeFile(path, 's3cret');
    vi.stubEnv('DB_PASSWORD', path);
    const { readSecret } = createSecretReader({
      isRunningInContainer: true,
      secretsDirectoryPath: '/unused',
    });

    expect(readSecret('DB_PASSWORD')).toBe('s3cret');
  });

  test('reports an unset variable as ENV_VARIABLE_MISSING', () => {
    vi.stubEnv('DB_PASSWORD', '');
    const { readSecret } = createSecretReader({
      isRunningInContainer: true,
      secretsDirectoryPath: directory,
    });

    expectToThrowCode(
      () => readSecret('DB_PASSWORD'),
      ERRORS.ENV_VARIABLE_MISSING,
      'The environment variable DB_PASSWORD is not set.',
    );
  });

  test('never shows the path, which may be the secret itself when the variable is set wrong', async () => {
    const empty = join(directory, 'empty');
    await writeFile(empty, '');
    vi.stubEnv('DB_PASSWORD', 'Zq9-the-password-itself');
    vi.stubEnv('EMPTY_SECRET', empty);
    const { readSecret } = createSecretReader({
      isRunningInContainer: true,
      secretsDirectoryPath: directory,
    });
    const missing = catchError(() => readSecret('DB_PASSWORD'));
    const blank = catchError(() => readSecret('EMPTY_SECRET'));

    expect(missing).toMatchObject({
      code: ERRORS.ENV_SECRET_FILE_UNREADABLE,
      message: "The secret DB_PASSWORD's file could not be read.",
      data: { key: 'DB_PASSWORD' },
    });
    expect((missing as Error).cause).toBeUndefined();
    expectNoValue(missing, 'Zq9');
    expect(blank).toMatchObject({
      message: "The secret EMPTY_SECRET's file is empty.",
      data: { key: 'EMPTY_SECRET' },
    });
    expectNoValue(blank, empty);
  });
});

describe('readSecretJson', () => {
  test('parses the file and returns what its schema returns, with a Zod schema', async () => {
    await writeFile(join(directory, 'ROOT_ACCOUNT.txt'), '{"email":"root@example.com"}');
    const { readSecretJson } = createSecretReader({
      isRunningInContainer: false,
      secretsDirectoryPath: directory,
    });

    expect(readSecretJson('ROOT_ACCOUNT', z.object({ email: z.email() }))).toStrictEqual({
      email: 'root@example.com',
    });
  });

  test('reports bad JSON or a schema failure without the secret, or a cause that could hold it', async () => {
    await writeFile(join(directory, 'BROKEN.txt'), '{"pin": Zq9}');
    await writeFile(join(directory, 'NESTED.txt'), '{"otp":{"secret":"Zq9"}}');
    const { readSecretJson } = createSecretReader({
      isRunningInContainer: false,
      secretsDirectoryPath: directory,
    });
    const broken = catchError(() => readSecretJson('BROKEN', z.unknown()));
    const nested = catchError(() =>
      readSecretJson('NESTED', z.object({ otp: z.object({ secret: z.number() }) })),
    );

    expect(broken).toMatchObject({
      code: ERRORS.ENV_VARIABLE_INVALID,
      message: 'The secret BROKEN is not valid JSON.',
    });
    expect(nested).toMatchObject({
      code: ERRORS.ENV_VARIABLE_INVALID,
      message: "The secret NESTED doesn't match its schema.",
    });
    for (const error of [broken, nested]) {
      expect((error as Error).cause).toBeUndefined();
      expectNoValue(error, 'Zq9');
    }
  });
});
