import { Exception } from 'jg-exception';

import { ERRORS } from './errors.js';

/**
 * Checks a time-to-live, which Redis takes in whole seconds, from 1.
 * @param ttlSeconds The time-to-live.
 * @throws
 * - INVALID_TTL: The time-to-live must be a whole number of seconds, from 1.
 */
export const assertTtl = (ttlSeconds: number): void => {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1) {
    throw new Exception('The time-to-live must be a whole number of seconds, from 1.', {
      code: ERRORS.INVALID_TTL,
      data: { ttlSeconds: String(ttlSeconds) },
    });
  }
};
