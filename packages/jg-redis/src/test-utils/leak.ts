import { inspect } from 'node:util';

import { extractMessage } from 'jg-exception';
import { expect } from 'vitest';

/**
 * Asserts that an error shows a value through none of the ways it gets printed: its extracted
 * message with every cause, an inspection of every field, its stack, and its JSON.
 * @param error The error.
 * @param value The value that must not show.
 */
export const expectNoValue = (error: unknown, value: string): void => {
  expect(extractMessage(error)).not.toContain(value);
  expect(inspect(error, { depth: null })).not.toContain(value);
  expect(String((error as Error).stack)).not.toContain(value);
  expect(JSON.stringify(error)).not.toContain(value);
};
