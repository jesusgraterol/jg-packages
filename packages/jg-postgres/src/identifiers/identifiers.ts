import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

// PostgreSQL keeps an identifier's first 63 bytes and silently drops the rest
const MAX_IDENTIFIER_BYTES = 63;

/**
 * Quotes a table, column, or constraint name for SQL that can't take it as a parameter. A name
 * PostgreSQL would cut short, an empty one, or one with a null character throws instead.
 * @param name The name, such as `order` or `sort_order`.
 * @returns The quoted name, such as `"order"`.
 * @example
 * import { quoteIdentifier } from 'jg-postgres';
 *
 * quoteIdentifier('order'); // => '"order"'
 * quoteIdentifier('say "hi"'); // => '"say ""hi"""'
 * @throws
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 */
export const quoteIdentifier = (name: string): string => {
  if (
    name.length === 0 ||
    name.includes('\0') ||
    Buffer.byteLength(name, 'utf8') > MAX_IDENTIFIER_BYTES
  ) {
    throw new Exception(
      'The identifier is empty, holds a null character, or is longer than 63 bytes.',
      { code: ERRORS.INVALID_IDENTIFIER, data: { identifier: name.slice(0, 100) } },
    );
  }
  return `"${name.replaceAll('"', '""')}"`;
};
