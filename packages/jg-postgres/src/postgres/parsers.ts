import { types, type CustomTypesConfig } from 'pg';

import { createTimestamp } from 'jg-utilities';

// the type IDs PostgreSQL sends NUMERIC and TIMESTAMPTZ values with
const NUMERIC_TYPE_ID = 1700;
const TIMESTAMPTZ_TYPE_ID = 1184;

/**
 * Picks the parser for a value's type: NUMERIC becomes a number and TIMESTAMPTZ an ISO 8601 UTC
 * string, while every other type, BIGINT's string included, keeps node-postgres's parser, so no
 * digit is lost.
 * @param typeId The value's type ID.
 * @param format Whether the value arrives as text or binary.
 * @returns The parser.
 */
const getTypeParser = (
  typeId: number,
  format: 'text' | 'binary' = 'text',
): ((value: string) => unknown) => {
  if (format === 'text' && typeId === NUMERIC_TYPE_ID) {
    return (value) => Number.parseFloat(value);
  }
  if (format === 'text' && typeId === TIMESTAMPTZ_TYPE_ID) {
    return (value) => createTimestamp(value);
  }
  return types.getTypeParser(typeId, format) as (value: string) => unknown;
};

// the parsers every pool uses, set on the pool rather than node-postgres's global registry, so
// other pools in the program keep their own
export const POOL_TYPES: CustomTypesConfig = { getTypeParser };
