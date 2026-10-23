// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import { DatabaseError, type PoolClient } from 'pg';
import { Exception, REDACTED_VALUE, type IJsonValue } from 'jg-exception';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { isCheckViolationError, isUniqueViolationError } from '../database-errors/index.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestPostgres } from '../test-utils/database.js';
import { createErrorLog } from './error-log.js';

// a row, as the README's table stores it
type IErrorLogRow = {
  origin: string;
  error: string;
  user_info: unknown;
  payload: unknown;
  deduplication_hash: string | null;
};

/**
 * Reads the README's "Error log" table, so the tests run the schema it documents.
 * @returns The table's DDL.
 */
const readDocumentedDdl = (): string => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const section = readme.slice(readme.indexOf('### Error log'));
  const ddl = /```sql\n([\s\S]*?)```/.exec(section)?.[1];
  if (ddl === undefined) {
    throw new Error('The README lost its error log SQL.');
  }
  return ddl;
};

const onError = vi.fn();
let postgres: IPostgres;

beforeAll(async () => {
  postgres = connectTestPostgres({ max: 8, onError });
  await postgres.query('DROP TABLE IF EXISTS error_log;');
  await postgres.query(readDocumentedDdl());
});

beforeEach(async () => {
  onError.mockClear();
  await postgres.query('TRUNCATE error_log;');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await postgres.query('DROP TABLE error_log;');
  await postgres.close();
});

/**
 * Reads every row, oldest first.
 * @returns A promise that resolves to the rows.
 */
const readRows = (): Promise<IErrorLogRow[]> =>
  postgres.query<IErrorLogRow>(
    'SELECT origin, error, user_info, payload, deduplication_hash FROM error_log ORDER BY id;',
  );

/**
 * Gives the one error onError received.
 * @returns The error.
 */
const readReport = (): unknown => {
  expect(onError).toHaveBeenCalledOnce();
  return onError.mock.calls[0]?.[0];
};

describe('record', () => {
  test('stores the message with its code, the user info, and the redacted payload', async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api', redactKeys: ['password', 'token'] });

    await expect(
      errorLog.record({
        error: new Exception('The upload failed.', {
          code: 'UPLOAD_FAILED',
          data: { Password: 'hunter2', nested: { TOKEN: 'abc', list: [{ token: 'def' }] }, id: 7 },
        }),
        userInfo: { userId: '42' },
      }),
    ).resolves.toBe(true);

    expect(await readRows()).toStrictEqual([
      {
        origin: 'api',
        error: 'UPLOAD_FAILED: The upload failed.',
        user_info: { userId: '42' },
        payload: {
          Password: REDACTED_VALUE,
          nested: { TOKEN: REDACTED_VALUE, list: [{ token: REDACTED_VALUE }] },
          id: 7,
        },
        deduplication_hash: null,
      },
    ]);
    expect(onError).not.toHaveBeenCalled();
  });

  test.each([
    ['null', null, null],
    ['empty', {}, {}],
    ['partial', { userId: '1', email: undefined }, { userId: '1' }],
    ['missing', undefined, null],
    ['not an object', 'ada@example.com', null],
  ])('stores %s user info as %o', async (_, userInfo, expected) => {
    const errorLog = createErrorLog(postgres, { origin: 'api' });

    await errorLog.record({ error: new Error('failed'), userInfo: userInfo as never });

    expect((await readRows())[0]?.user_info).toStrictEqual(expected);
  });

  test("stores an Error's or a string's message, and only an Exception's object data", async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api' });

    await errorLog.recordMany([
      { error: new Error('plain') },
      { error: 'a string' },
      { error: new Exception('listed', { code: 'LISTED', data: [1, 2] }) },
      { error: new Exception('texted', { code: 'TEXTED', data: 'text' }) },
    ]);

    expect((await readRows()).map(({ error, payload }) => [error, payload])).toStrictEqual([
      ['plain', null],
      ['a string', null],
      ['LISTED: listed', null],
      ['TEXTED: texted', null],
    ]);
  });

  test("removes null characters, and keeps an entry's origin unless it isn't valid", async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api' });

    await errorLog.recordMany([
      {
        error: new Exception('nul\0 here', { code: 'NUL', data: { 'ke\0y': 'va\0lue' } }),
        origin: 'worker',
        userInfo: { name: 'Ada\0' },
      },
      { error: new Error('\0'), origin: 'a'.repeat(257) },
      { error: new Error('other'), origin: '' },
    ]);

    expect(await readRows()).toMatchObject([
      {
        origin: 'worker',
        error: 'NUL: nul here',
        payload: { key: 'value' },
        user_info: { name: 'Ada' },
      },
      { origin: 'api' },
      { origin: 'api', error: 'other' },
    ]);
    expect((await readRows())[1]?.error).toMatch(/^The error message could not be extracted/);
  });

  test('leaves out a cycle in user info, and stores a Date and a BigInt as JSON does', async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api' });
    const userInfo: Record<string, unknown> = {
      at: new Date('2026-01-01T00:00:00.000Z'),
      big: 10n,
    };
    userInfo['self'] = userInfo;

    await errorLog.record({ error: new Error('cyclic'), userInfo: userInfo as never });

    expect((await readRows())[0]?.user_info).toStrictEqual({
      at: '2026-01-01T00:00:00.000Z',
      big: '10',
    });
  });

  test('cuts a long message to maxMessageLength by code points, keeping an emoji at the edge whole', async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api', maxMessageLength: 16 });

    await errorLog.record({ error: new Error(`abc${'😀'.repeat(30)}`) });

    expect((await readRows())[0]?.error).toBe('abc😀 [truncated]');
  });

  test('stores a message as long as the column allows by default', async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api' });

    await errorLog.record({ error: new Error('é'.repeat(20_000)) });

    const [row] = await readRows();
    expect([...(row?.error ?? '')]).toHaveLength(8_192);
    expect(row?.error.endsWith(' [truncated]')).toBe(true);
  });

  test("leaves out an oversized payload, recording the rest of its row and its batch's other rows", async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api', maxPayloadBytes: 64 });

    await expect(
      errorLog.recordMany([
        { error: new Exception('large', { code: 'LARGE', data: { text: 'x'.repeat(100) } }) },
        { error: new Exception('small', { code: 'SMALL', data: { id: 1 } }) },
      ]),
    ).resolves.toBe(2);

    expect((await readRows()).map(({ error, payload }) => [error, payload])).toStrictEqual([
      ['LARGE: large', null],
      ['SMALL: small', { id: 1 }],
    ]);
  });

  test('stores a payload nested 256 levels deep, and leaves out deeper ones', async () => {
    const nest = (levels: number): { [key: string]: unknown } => {
      let value: { [key: string]: unknown } = { id: levels };
      for (let level = 1; level < levels; level += 1) {
        value = { next: value };
      }
      return value;
    };
    // room for any of them, so only the depth leaves one out
    const errorLog = createErrorLog(postgres, { origin: 'api', maxPayloadBytes: 1_048_576 });

    await expect(
      errorLog.recordMany(
        [256, 257, 100_000].map((levels) => ({
          error: new Exception('deep', { code: 'DEEP', data: nest(levels) as IJsonValue }),
        })),
      ),
    ).resolves.toBe(3);

    expect((await readRows()).map(({ payload }) => payload)).toStrictEqual([nest(256), null, null]);
  });

  test('records nothing, and resolves to 0, for an empty list or something that is not a list', async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api' });

    await expect(errorLog.recordMany([])).resolves.toBe(0);
    await expect(errorLog.recordMany('errors' as never)).resolves.toBe(0);
    expect(await readRows()).toStrictEqual([]);
  });
});

describe('deduplication', () => {
  test('stores the SHA-256 digest of the key, once per origin and key', async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api' });
    const key = 'project:42:audit';

    await expect(
      errorLog.record({ error: new Error('first'), deduplicationKey: key }),
    ).resolves.toBe(true);
    await expect(
      errorLog.record({ error: new Error('again'), deduplicationKey: key }),
    ).resolves.toBe(false);
    await expect(
      errorLog.record({ error: new Error('elsewhere'), deduplicationKey: key, origin: 'worker' }),
    ).resolves.toBe(true);
    await expect(errorLog.record({ error: new Error('unkeyed') })).resolves.toBe(true);
    await expect(errorLog.record({ error: new Error('unkeyed') })).resolves.toBe(true);

    const digest = createHash('sha256').update(key).digest('hex');
    expect(
      (await readRows()).map(({ origin, deduplication_hash }) => [origin, deduplication_hash]),
    ).toStrictEqual([
      ['api', digest],
      ['worker', digest],
      ['api', null],
      ['api', null],
    ]);
  });

  test("keeps the identity of a row an app stored with node:crypto's digest of the same key", async () => {
    const key = JSON.stringify(['project-repository', 42, 'background-failure']);
    await postgres.query(
      'INSERT INTO error_log (origin, error, deduplication_hash) VALUES ($1, $2, $3);',
      ['api', 'stored before the move', createHash('sha256').update(key, 'utf8').digest('hex')],
    );
    const errorLog = createErrorLog(postgres, { origin: 'api' });

    await expect(
      errorLog.record({ error: new Error('again'), deduplicationKey: key }),
    ).resolves.toBe(false);
    await expect(errorLog.recordMany([{ error: 'again', deduplicationKey: key }])).resolves.toBe(0);
    expect(await readRows()).toHaveLength(1);
  });

  test('inserts concurrent duplicates once', async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api' });

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        errorLog.record({ error: new Error('burst'), deduplicationKey: 'burst' }),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await readRows()).toHaveLength(1);
  });
});

describe('writes', () => {
  test('writes a long list in chunks of maxBatchSize, in one transaction', async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api', maxBatchSize: 2 });
    const realTransaction = postgres.transaction.bind(postgres);
    const inserts: unknown[] = [];
    vi.spyOn(postgres, 'transaction').mockImplementation((operation, options) =>
      realTransaction((client: PoolClient) => {
        const realQuery = client.query.bind(client) as (...args: unknown[]) => unknown;
        vi.spyOn(client, 'query').mockImplementation((...args: unknown[]) => {
          const [query] = args as [{ text?: unknown } | string];
          if (typeof query === 'object' && String(query.text).startsWith('INSERT INTO')) {
            inserts.push(query);
          }
          return realQuery(...args);
        });
        return operation(client);
      }, options),
    );

    await expect(
      errorLog.recordMany(
        Array.from({ length: 5 }, (_, index) => ({ error: `error ${String(index)}` })),
      ),
    ).resolves.toBe(5);

    expect(inserts).toHaveLength(3);
    expect(postgres.transaction).toHaveBeenCalledOnce();
    expect(await readRows()).toHaveLength(5);
  });

  test('inserts nothing when one row breaks a constraint, reports it without the rows, and records them on a retry', async () => {
    await postgres.query(
      "ALTER TABLE error_log ADD CONSTRAINT chk_el__error_test CHECK (error NOT LIKE '%forbidden%');",
    );
    try {
      const errorLog = createErrorLog(postgres, { origin: 'api', maxBatchSize: 1 });
      const entries = [
        { error: new Error('first secret-ish detail'), userInfo: { userId: 'u-1' } },
        { error: new Error('forbidden secret-ish detail') },
      ];

      await expect(errorLog.recordMany(entries)).resolves.toBe(0);

      expect(await readRows()).toStrictEqual([]);
      const report = readReport();
      expect(report).toMatchObject({
        code: ERRORS.ERROR_LOG_WRITE_FAILED,
        message: "The errors couldn't be written to the error log.",
        data: { sqlState: '23514', entryCount: 2 },
      });
      expect((report as Error).cause).toBeUndefined();
      expect(JSON.stringify(report)).not.toMatch(/secret-ish|u-1|forbidden/);
      await expect(errorLog.recordMany(entries.slice(0, 1))).resolves.toBe(1);
    } finally {
      await postgres.query('ALTER TABLE error_log DROP CONSTRAINT chk_el__error_test;');
    }
  });

  test('swallows a database failure, such as a missing table, reporting it', async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api', table: 'missing_error_log' });

    await expect(errorLog.record({ error: new Error('lost') })).resolves.toBe(false);

    expect(readReport()).toMatchObject({
      code: ERRORS.ERROR_LOG_WRITE_FAILED,
      data: { sqlState: '42P01', entryCount: 1 },
    });
  });

  test.each([
    ['is not a database error', new Error('pool closed')],
    ['is a database error without a code', new DatabaseError('unknown failure', 0, 'error')],
  ])('reports a failure that %s with no SQLSTATE', async (_, failure) => {
    const errorLog = createErrorLog(postgres, { origin: 'api' });
    vi.spyOn(postgres, 'transaction').mockRejectedValueOnce(failure);

    await expect(errorLog.record({ error: new Error('lost') })).resolves.toBe(false);

    expect(readReport()).toMatchObject({ data: { sqlState: null, entryCount: 1 } });
  });

  test('gives up within its lock timeout when another transaction locks the table, reporting no content', async () => {
    const errorLog = createErrorLog(postgres, { origin: 'api' });
    const locker = await postgres.pool.connect();
    try {
      await locker.query('BEGIN; LOCK TABLE error_log IN ACCESS EXCLUSIVE MODE;');
      const startedAt = Date.now();

      await expect(
        errorLog.record({
          error: new Error('blocked private detail'),
          userInfo: { userId: 'u-2' },
        }),
      ).resolves.toBe(false);

      expect(Date.now() - startedAt).toBeLessThan(4_000);
      const report = readReport();
      expect(report).toMatchObject({ data: { sqlState: '55P03' } });
      expect(JSON.stringify(report)).not.toMatch(/private|u-2/);
    } finally {
      await locker.query('ROLLBACK;');
      locker.release();
    }
  });
});

describe('onRecorded', () => {
  test('receives the count after the write commits, without delaying it', async () => {
    let visibleCount = -1;
    let resolveRecorded: () => void = () => undefined;
    const recorded = new Promise<void>((resolve) => {
      resolveRecorded = resolve;
    });
    const onRecorded = vi.fn(async ({ count }: { count: number }) => {
      visibleCount = (await readRows()).length;
      expect(count).toBe(2);
      resolveRecorded();
    });
    const errorLog = createErrorLog(postgres, { origin: 'api', onRecorded });

    await errorLog.recordMany([{ error: 'one' }, { error: 'two' }]);
    await recorded;

    expect(onRecorded).toHaveBeenCalledExactlyOnceWith({ count: 2 });
    expect(visibleCount).toBe(2);
  });

  test('is not called when nothing was inserted', async () => {
    const onRecorded = vi.fn();
    const errorLog = createErrorLog(postgres, { origin: 'api', onRecorded });
    await errorLog.record({ error: 'once', deduplicationKey: 'once' });
    onRecorded.mockClear();

    await errorLog.record({ error: 'once', deduplicationKey: 'once' });
    await sleep(50);

    expect(onRecorded).not.toHaveBeenCalled();
  });

  test('never holds up a write, even when it never settles', async () => {
    const errorLog = createErrorLog(postgres, {
      origin: 'api',
      onRecorded: () => new Promise<void>(() => undefined),
    });

    await expect(errorLog.record({ error: 'stalled' })).resolves.toBe(true);
    expect(await readRows()).toHaveLength(1);
  });

  test.each([
    ['rejects', () => Promise.reject(new Error('counter unavailable'))],
    [
      'throws',
      () => {
        throw new Error('counter unavailable');
      },
    ],
  ])('reports what it %s with, keeping the rows', async (_, onRecorded) => {
    const errorLog = createErrorLog(postgres, { origin: 'api', onRecorded });

    await expect(errorLog.record({ error: 'counted' })).resolves.toBe(true);

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledExactlyOnceWith(new Error('counter unavailable'));
    });
    expect(await readRows()).toHaveLength(1);
  });
});

describe('the documented table', () => {
  test.each([
    ['an empty origin', "('', 'e', NULL, NULL, NULL)"],
    ['an empty error', "('api', '', NULL, NULL, NULL)"],
    ['user info that is not an object', "('api', 'e', '[1]'::jsonb, NULL, NULL)"],
    ['a payload that is not an object', "('api', 'e', NULL, '\"text\"'::jsonb, NULL)"],
    ['a hash that is not lowercase hex', `('api', 'e', NULL, NULL, '${'A'.repeat(64)}')`],
  ])('refuses %s', async (_, values) => {
    const error = await postgres
      .query(
        `INSERT INTO error_log (origin, error, user_info, payload, deduplication_hash) VALUES ${values};`,
      )
      .catch((cause: unknown) => cause);

    expect(isCheckViolationError(error)).toBe(true);
  });

  test('refuses a repeated origin and hash, and allows any number of rows without a hash', async () => {
    const hash = 'a'.repeat(64);
    await postgres.query(
      `INSERT INTO error_log (origin, error, deduplication_hash)
      VALUES ('api', 'e', $1), ('api', 'e', NULL), ('api', 'e', NULL), ('worker', 'e', $1);`,
      [hash],
    );

    const error = await postgres
      .query("INSERT INTO error_log (origin, error, deduplication_hash) VALUES ('api', 'e', $1);", [
        hash,
      ])
      .catch((cause: unknown) => cause);

    expect(isUniqueViolationError(error, 'uq_el__origin_deduplication_hash')).toBe(true);
  });
});
