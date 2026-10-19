import { expectToThrowCode } from 'jg-exception/testing';
import { describe, test } from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';

import { createOptionalReader } from './optional-reads.js';
import type { IOptionalReaderOptions } from './types.js';

// a database the validation never uses
const postgres = { pool: {} } as unknown as IPostgres;

describe('createOptionalReader', () => {
  test.each<[string, Partial<IOptionalReaderOptions> | Record<string, unknown>]>([
    ['no database', { postgres: undefined }],
    ['a database that is null', { postgres: null }],
    ['maxActiveReads of 0', { maxActiveReads: 0 }],
    ['fractional maxActiveReads', { maxActiveReads: 1.5 }],
    ['negative reservedIdleClients', { reservedIdleClients: -1 }],
    ['fractional reservedIdleClients', { reservedIdleClients: 0.5 }],
    ['admissionSeconds of 0', { admissionSeconds: 0 }],
    ['infinite admissionSeconds', { admissionSeconds: Infinity }],
    [
      'a timeout profile that is not valid',
      { timeouts: { statementTimeoutSeconds: 1, lockTimeoutSeconds: 2, queryTimeoutSeconds: 3 } },
    ],
  ])('throws INVALID_OPTIONAL_READ_OPTIONS for %s', (_, overrides) => {
    expectToThrowCode(
      () => createOptionalReader({ postgres, ...overrides }),
      ERRORS.INVALID_OPTIONAL_READ_OPTIONS,
    );
  });
});
