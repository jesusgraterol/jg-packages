import type { Pool, PoolClient } from 'pg';

import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';
import {
  assertTimeoutProfile,
  buildTransactionTimeoutsQuery,
  defineTimeoutProfile,
  type ITimeoutProfile,
  withQueryTimeout,
} from '../timeouts/index.js';

import type { IOptionalRead, IOptionalReader, IOptionalReaderOptions } from './types.js';

// the defaults of the reader's options, as Moldea's header counters use them
const DEFAULT_MAX_ACTIVE_READS = 2;
const DEFAULT_RESERVED_IDLE_CLIENTS = 2;
const DEFAULT_ADMISSION_SECONDS = 1;

/**
 * Gives the read of something that won't run now.
 * @returns A read whose value is null.
 */
const createSkippedRead = <T>(): IOptionalRead<T> => ({
  getSnapshot: () => null,
  completion: Promise.resolve(null),
});

/**
 * Checks the reader's options, filling in the defaults.
 * @param options The options.
 * @returns The options, complete.
 * @throws
 * - INVALID_OPTIONAL_READ_OPTIONS: The optional reader needs a database, whole positive maxActiveReads, whole reservedIdleClients from 0, positive admissionSeconds, and a valid timeout profile.
 */
const resolveOptions = ({
  postgres,
  maxActiveReads = DEFAULT_MAX_ACTIVE_READS,
  reservedIdleClients = DEFAULT_RESERVED_IDLE_CLIENTS,
  admissionSeconds = DEFAULT_ADMISSION_SECONDS,
  timeouts,
}: IOptionalReaderOptions): {
  pool: Pool;
  maxActiveReads: number;
  reservedIdleClients: number;
  admissionMs: number;
  timeouts: ITimeoutProfile;
} => {
  const profile =
    timeouts ??
    defineTimeoutProfile({
      statementTimeoutSeconds: 0.5,
      lockTimeoutSeconds: 0.1,
      queryGraceSeconds: 0.25,
    });
  let isProfileValid = true;
  try {
    assertTimeoutProfile(profile);
  } catch {
    isProfileValid = false;
  }
  if (
    typeof postgres !== 'object' ||
    postgres === null ||
    !Number.isSafeInteger(maxActiveReads) ||
    maxActiveReads < 1 ||
    !Number.isSafeInteger(reservedIdleClients) ||
    reservedIdleClients < 0 ||
    !(Number.isFinite(admissionSeconds) && admissionSeconds > 0) ||
    !isProfileValid
  ) {
    throw new Exception(
      'The optional reader needs a database, whole positive maxActiveReads, whole reservedIdleClients from 0, positive admissionSeconds, and a valid timeout profile.',
      { code: ERRORS.INVALID_OPTIONAL_READ_OPTIONS },
    );
  }
  return {
    pool: postgres.pool,
    maxActiveReads,
    reservedIdleClients,
    admissionMs: admissionSeconds * 1000,
    timeouts: profile,
  };
};

/**
 * Runs a read in a read-only transaction with the profile's timeouts, on a client of its own. A
 * client that arrives after the signal aborted is released untouched, and one the signal aborts
 * while its SQL runs is destroyed, which also stops the SQL. Any failure gives null.
 * @param pool The pool.
 * @param query The query's text and values.
 * @param parse Turns the first row into the value.
 * @param timeouts The read's timeouts.
 * @param signal Aborts when the read runs out of time.
 * @returns A promise that resolves to the value, or null; it never rejects.
 */
const runRead = async <T>(
  pool: Pool,
  query: { text: string; values?: unknown[] | undefined },
  parse: (row: unknown) => T,
  timeouts: ITimeoutProfile,
  signal: AbortSignal,
): Promise<T | null> => {
  let client: PoolClient | undefined;
  let isReleased = false;
  // a client is destroyed unless its transaction ended cleanly
  let shouldDestroyClient = false;
  const destroyClient = (): void => {
    if (client !== undefined && !isReleased) {
      isReleased = true;
      client.release(true);
    }
  };
  signal.addEventListener('abort', destroyClient, { once: true });
  try {
    client = await pool.connect();
    if (signal.aborted) {
      return null;
    }
    shouldDestroyClient = true;
    await client.query(withQueryTimeout({ text: 'BEGIN READ ONLY;' }, timeouts));
    await client.query(withQueryTimeout(buildTransactionTimeoutsQuery(timeouts), timeouts));
    const { rows } = await client.query(withQueryTimeout(query, timeouts));
    const value = parse(rows[0]);
    await client.query(withQueryTimeout({ text: 'COMMIT;' }, timeouts));
    shouldDestroyClient = false;
    return value;
  } catch {
    return null;
  } finally {
    signal.removeEventListener('abort', destroyClient);
    if (client !== undefined && !isReleased) {
      client.release(shouldDestroyClient);
    }
  }
};

/**
 * Creates a reader for optional data, such as counters in a page's header, that must never delay
 * or crowd out essential work. A read is skipped, giving null at once, when the reader already
 * runs maxActiveReads reads, a request waits for a client, or the pool can't give more clients
 * than reservedIdleClients, counting idle ones and the room left to open new ones. A running read
 * gives null once admissionSeconds pass, and is shared by every caller of the same key until it
 * ends. Each read runs in a read-only transaction with short timeouts of its own, and never
 * throws.
 * @param options The database, and optionally the limits and the reads' timeouts.
 * @returns The reader.
 * @example
 * import { createOptionalReader, createPostgres } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 * declare const accountId: string;
 *
 * const counters = createOptionalReader({ postgres });
 *
 * const unread = counters.read(
 *   `unread:${accountId}`,
 *   { text: 'SELECT count(*)::int AS count FROM notification WHERE account_id = $1 AND read_at IS NULL;', values: [accountId] },
 *   (row) => (row as { count: number }).count,
 * );
 * const count = await unread.completion; // a number, or null when the database is busy
 * @throws
 * - INVALID_OPTIONAL_READ_OPTIONS: The optional reader needs a database, whole positive maxActiveReads, whole reservedIdleClients from 0, positive admissionSeconds, and a valid timeout profile.
 */
export const createOptionalReader = (options: IOptionalReaderOptions): IOptionalReader => {
  const { pool, maxActiveReads, reservedIdleClients, admissionMs, timeouts } =
    resolveOptions(options);
  const reads = new Map<string, IOptionalRead<unknown>>();
  let activeReads = 0;

  return {
    read: <T>(
      key: string,
      query: { text: string; values?: unknown[] | undefined },
      parse: (row: unknown) => T,
    ): IOptionalRead<T> => {
      const running = reads.get(key);
      if (running !== undefined) {
        return running as IOptionalRead<T>;
      }
      const spareClients = pool.idleCount + (pool.options.max - pool.totalCount);
      if (
        activeReads >= maxActiveReads ||
        pool.waitingCount > 0 ||
        spareClients <= reservedIdleClients
      ) {
        return createSkippedRead<T>();
      }
      const controller = new AbortController();
      let snapshot: T | null = null;
      let deadline: ReturnType<typeof setTimeout> | undefined;
      const expiry = new Promise<null>((resolve) => {
        deadline = setTimeout(() => {
          controller.abort();
          resolve(null);
        }, admissionMs);
      });
      const work = runRead(pool, query, parse, timeouts, controller.signal).then((value) => {
        if (!controller.signal.aborted) {
          snapshot = value;
        }
        // the slot stays taken until the client is back, even when the deadline resolved first
        clearTimeout(deadline);
        reads.delete(key);
        activeReads -= 1;
        return snapshot;
      });
      const read: IOptionalRead<T> = {
        getSnapshot: () => snapshot,
        completion: Promise.race([work, expiry]),
      };
      reads.set(key, read);
      activeReads += 1;
      return read;
    },
  };
};
