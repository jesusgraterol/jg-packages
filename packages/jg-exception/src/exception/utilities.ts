import { EXCEPTION_BRAND } from './constants.js';
import type { Exception } from './exception.js';

/**
 * Checks whether a value is an `Exception`, including one created by another installed copy of
 * the package, where `instanceof` fails.
 * @param value The value to check.
 * @returns Whether the value is an Exception.
 * @example
 * isException(new Exception('Not found', 'NOT_FOUND')); // true
 * isException(new Error('Not found')); // false
 */
export const isException = (value: unknown): value is Exception =>
  value instanceof Error && (value as unknown as Record<symbol, unknown>)[EXCEPTION_BRAND] === true;
