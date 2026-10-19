import { Exception } from 'jg-exception';
import { isIntegerValid, isObjectValid } from 'jg-utilities';

import { quoteIdentifier } from '../identifiers/index.js';
import { ERRORS, type IQueryExecutor } from '../shared/index.js';
import type { IExpiredRowDeletionOptions, IRetentionAge } from './types.js';

// the rows a batch deletes when the options don't set it
const DEFAULT_BATCH_SIZE = 1_024;

// the most rows a batch may delete, so one statement's locks and work stay bounded
const MAX_BATCH_SIZE = 8_192;

// the largest months or days make_interval takes, its integer arguments' maximum
const MAX_INTERVAL_FIELD = 2_147_483_647;

// the options validated, with their identifiers quoted and their defaults applied
type IDeletionPlan = {
  quotedTable: string;
  quotedTimestamp: string;
  quotedKey: string;
  olderThan: Required<{ [K in keyof IRetentionAge]: number }> | undefined;
  cutoff: string | undefined;
  batchSize: number;
  filters: { quotedColumn: string; value: unknown }[];
};

/**
 * Builds the exception for options that aren't valid.
 * @returns The INVALID_EXPIRED_DELETION exception.
 */
const invalidDeletion = (): Exception =>
  new Exception(
    'The expired-row deletion needs exactly one of olderThan, with whole months, days, and seconds of at least 0 that are not all 0, and cutoff, a valid date, a whole batch size from 1 to 8192, and filters that each name a column.',
    { code: ERRORS.INVALID_EXPIRED_DELETION },
  );

/**
 * Validates a retention age, and fills its missing fields with 0.
 * @param age The age.
 * @returns The months, days, and seconds.
 * @throws
 * - INVALID_EXPIRED_DELETION: The expired-row deletion needs exactly one of olderThan, with whole months, days, and seconds of at least 0 that are not all 0, and cutoff, a valid date, a whole batch size from 1 to 8192, and filters that each name a column.
 */
const readAge = (age: unknown): Required<{ [K in keyof IRetentionAge]: number }> => {
  if (!isObjectValid(age, true)) {
    throw invalidDeletion();
  }
  const { months = 0, days = 0, seconds = 0 } = age as IRetentionAge;
  if (
    !isIntegerValid(months, 0, MAX_INTERVAL_FIELD) ||
    !isIntegerValid(days, 0, MAX_INTERVAL_FIELD) ||
    !isIntegerValid(seconds, 0) ||
    months + days + seconds === 0
  ) {
    throw invalidDeletion();
  }
  return { months, days, seconds };
};

/**
 * Validates a cutoff, and gives it as an ISO 8601 UTC timestamp.
 * @param cutoff The cutoff.
 * @returns The timestamp.
 * @throws
 * - INVALID_EXPIRED_DELETION: The expired-row deletion needs exactly one of olderThan, with whole months, days, and seconds of at least 0 that are not all 0, and cutoff, a valid date, a whole batch size from 1 to 8192, and filters that each name a column.
 */
const readCutoff = (cutoff: unknown): string => {
  const time =
    cutoff instanceof Date
      ? cutoff.getTime()
      : typeof cutoff === 'string'
        ? Date.parse(cutoff)
        : Number.NaN;
  if (Number.isNaN(time)) {
    throw invalidDeletion();
  }
  return new Date(time).toISOString();
};

/**
 * Checks whether filters are a list of objects that each name a column.
 * @param filters The filters.
 * @returns Whether they are.
 */
const areFiltersValid = (filters: unknown): boolean =>
  Array.isArray(filters) &&
  filters.every(
    (filter: unknown) => isObjectValid(filter, true) && typeof filter['column'] === 'string',
  );

/**
 * Validates deleteExpiredInBatches's options, quotes their identifiers, and applies the defaults.
 * @param options The options.
 * @returns What the deletion runs with.
 * @throws
 * - INVALID_EXPIRED_DELETION: The expired-row deletion needs exactly one of olderThan, with whole months, days, and seconds of at least 0 that are not all 0, and cutoff, a valid date, a whole batch size from 1 to 8192, and filters that each name a column.
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 */
export const readDeletionPlan = (options: IExpiredRowDeletionOptions): IDeletionPlan => {
  const {
    table,
    timestampColumn = 'created_at',
    keyColumn = 'id',
    olderThan,
    cutoff,
    batchSize = DEFAULT_BATCH_SIZE,
    filters = [],
  } = options;
  if (
    (olderThan === undefined) === (cutoff === undefined) ||
    !isIntegerValid(batchSize, 1, MAX_BATCH_SIZE) ||
    !areFiltersValid(filters)
  ) {
    throw invalidDeletion();
  }
  return {
    quotedTable: quoteIdentifier(table),
    quotedTimestamp: quoteIdentifier(timestampColumn),
    quotedKey: quoteIdentifier(keyColumn),
    olderThan: olderThan === undefined ? undefined : readAge(olderThan),
    cutoff: cutoff === undefined ? undefined : readCutoff(cutoff),
    batchSize,
    filters: filters.map(({ column, value }) => ({ quotedColumn: quoteIdentifier(column), value })),
  };
};

/**
 * Turns a retention age into a cutoff from the database's clock, subtracting the months and days
 * on the UTC calendar, so six months before August 31 is the last day of February, then the
 * seconds.
 * @param executor The pool or a client.
 * @param age The months, days, and seconds.
 * @param referenceTime The time to count back from, the database's now() when it's undefined.
 * @returns A promise that resolves to the cutoff, as an ISO 8601 UTC timestamp.
 */
export const readRetentionCutoff = async (
  executor: IQueryExecutor,
  { months, days, seconds }: Required<{ [K in keyof IRetentionAge]: number }>,
  referenceTime?: string,
): Promise<string> => {
  const { rows } = await executor.query<{ cutoff: string }>(
    `SELECT ((COALESCE($4::timestamptz, now()) AT TIME ZONE 'UTC')
        - make_interval(months => $1, days => $2, secs => $3)) AT TIME ZONE 'UTC' AS cutoff;`,
    [months, days, seconds, referenceTime ?? null],
  );
  // the query always returns one row
  return (rows[0] as { cutoff: string }).cutoff;
};
