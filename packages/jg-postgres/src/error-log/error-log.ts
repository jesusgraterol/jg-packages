import { Exception } from 'jg-exception';

import { isDatabaseError } from '../database-errors/index.js';
import { quoteIdentifier } from '../identifiers/index.js';
import { getErrorReporter } from '../postgres/postgres.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { assertTimeoutProfile, defineTimeoutProfile, withQueryTimeout } from '../timeouts/index.js';
import type { IErrorLog, IErrorLogEntry, IErrorLogOptions } from './types.js';
import { areOptionsValid, buildRow, invalidOptions, type IErrorLogRow } from './utilities.js';

// how long a write may run and wait for a lock when the options don't say
const DEFAULT_TIMEOUTS = defineTimeoutProfile({
  statementTimeoutSeconds: 5,
  lockTimeoutSeconds: 1,
});

/**
 * Creates an error log that records errors in a table the README defines, such as the errors an
 * API's exception filter catches. A record's message is the error's message, prefixed with its
 * code, without null characters and cut to `maxMessageLength`; an Exception's object data is its
 * payload, with `redactKeys` replaced at any depth, left out when it's larger than
 * `maxPayloadBytes`; and a `deduplicationKey` stores one row per origin and key, by the key's
 * SHA-256 digest in lowercase hex. A write runs in one transaction with `timeouts`, in INSERTs of
 * at most `maxBatchSize` rows, and never rejects: a failure goes to the database's onError as
 * ERROR_LOG_WRITE_FAILED, with the SQLSTATE and without the rows, and the write resolves to 0.
 * @param postgres The database.
 * @param options The log's origin and table, and its redaction, limits, and timeouts.
 * @returns The functions that record errors.
 * @example
 * import { createPostgres } from 'jg-postgres';
 * import { createErrorLog } from 'jg-postgres/error-log';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const errorLog = createErrorLog(postgres, { origin: 'api', redactKeys: ['password', 'token'] });
 * await errorLog.record({ error: new Error('The upload failed.'), userInfo: { userId: '42' } });
 * @throws
 * - INVALID_ERROR_LOG_OPTIONS: The error log needs an origin of 1 to 256 characters, redact keys that are strings, a whole message length of at least 16, a whole payload size of at least 16 bytes, a whole batch size from 1 to 8192, and an onRecorded that's a function when it's given.
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 * - INVALID_TIMEOUT_PROFILE: The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.
 */
export const createErrorLog = (postgres: IPostgres, options: IErrorLogOptions): IErrorLog => {
  const {
    origin,
    table = 'error_log',
    redactKeys = [],
    maxMessageLength = 8_192,
    maxPayloadBytes = 1_024,
    maxBatchSize = 256,
    timeouts = DEFAULT_TIMEOUTS,
    onRecorded,
  } = options;
  if (
    !areOptionsValid({
      origin,
      redactKeys,
      maxMessageLength,
      maxPayloadBytes,
      maxBatchSize,
      onRecorded,
    })
  ) {
    throw invalidOptions();
  }
  assertTimeoutProfile(timeouts);
  const insertText = `INSERT INTO ${quoteIdentifier(table)}
  (origin, error, user_info, payload, deduplication_hash)
SELECT *
FROM unnest($1::varchar[], $2::varchar[], $3::jsonb[], $4::jsonb[], $5::char(64)[])
ON CONFLICT (origin, deduplication_hash) DO NOTHING;`;
  const rowOptions = { origin, redactKeys: [...redactKeys], maxMessageLength, maxPayloadBytes };
  const reportError = getErrorReporter(postgres);

  /**
   * Hands a committed write's count to onRecorded without waiting for it, reporting what it
   * throws or rejects with.
   * @param count The rows inserted.
   */
  const notifyRecorded = (count: number): void => {
    if (onRecorded === undefined || count === 0) {
      return;
    }
    void (async () => {
      try {
        await onRecorded({ count });
      } catch (error) {
        reportError(error);
      }
    })();
  };

  /**
   * Inserts rows in chunks, in one transaction.
   * @param rows The rows.
   * @returns A promise that resolves to the rows inserted.
   */
  const insertRows = (rows: IErrorLogRow[]): Promise<number> =>
    postgres.transaction(
      async (client) => {
        let insertedCount = 0;
        for (let start = 0; start < rows.length; start += maxBatchSize) {
          const chunk = rows.slice(start, start + maxBatchSize);
          const result = await client.query(
            withQueryTimeout(
              {
                text: insertText,
                values: [
                  chunk.map((row) => row.origin),
                  chunk.map((row) => row.error),
                  chunk.map((row) => row.userInfo),
                  chunk.map((row) => row.payload),
                  chunk.map((row) => row.deduplicationHash),
                ],
              },
              timeouts,
            ),
          );
          insertedCount += Number(result.rowCount);
        }
        return insertedCount;
      },
      { timeouts },
    );

  /**
   * Records entries, never rejecting.
   * @param entries The entries.
   * @returns A promise that resolves to the rows inserted, or 0 when the write failed.
   */
  const recordMany = async (entries: readonly IErrorLogEntry[]): Promise<number> => {
    // a caller that skips type checking may pass something else, which records nothing
    const isList: boolean = Array.isArray(entries);
    if (!isList || entries.length === 0) {
      return 0;
    }
    try {
      const count = await insertRows(entries.map((entry) => buildRow(entry, rowOptions)));
      notifyRecorded(count);
      return count;
    } catch (error) {
      // the database's error quotes the failing row, so only its SQLSTATE goes in the report
      reportError(
        new Exception("The errors couldn't be written to the error log.", {
          code: ERRORS.ERROR_LOG_WRITE_FAILED,
          data: {
            sqlState: isDatabaseError(error) ? (error.code ?? null) : null,
            entryCount: entries.length,
          },
        }),
      );
      return 0;
    }
  };

  return {
    record: async (entry) => (await recordMany([entry])) === 1,
    recordMany,
  };
};
