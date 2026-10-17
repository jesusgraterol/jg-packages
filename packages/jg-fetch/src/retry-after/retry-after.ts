import { MAX_TIMEOUT_SECONDS } from '../shared/index.js';

// a delay in whole seconds, the first form Retry-After takes
const DELAY_SECONDS_PATTERN = /^\d+$/;

// an HTTP date, the second form: IMF-fixdate and the obsolete RFC 850 dates start with the day,
// such as 'Wed, 21 Oct 2015 07:28:00 GMT'
const HTTP_DATE_PATTERN = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? /i;

// the obsolete asctime date, which has no zone and is always in GMT, such as
// 'Sun Nov  6 08:49:37 1994'
const ASCTIME_DATE_PATTERN = /^[a-z]{3} [a-z]{3} [ \d]\d \d{2}:\d{2}:\d{2} \d{4}$/i;

// the longest wait the result can hold, in milliseconds
const MAX_RETRY_AFTER_MS = MAX_TIMEOUT_SECONDS * 1000;

/**
 * Parses a Retry-After header into the milliseconds to wait. It accepts a delay in seconds, such as
 * `120`, or an HTTP date, such as `Wed, 21 Oct 2015 07:28:00 GMT`, whose wait is counted from
 * nowMs. A date in the past waits 0, and a wait longer than MAX_TIMEOUT_SECONDS is clamped to it.
 * For a header with several values, such as a WebSocket handshake's, the first one counts.
 * @param value The header's value, or its values.
 * @param nowMs The current time, in milliseconds since the epoch. Defaults to Date.now().
 * @returns The milliseconds to wait, or null when the value is missing or invalid.
 * @example
 * import { parseRetryAfterMs } from 'jg-fetch';
 *
 * parseRetryAfterMs('120'); // 120000
 * parseRetryAfterMs('Wed, 21 Oct 2015 07:28:30 GMT', Date.parse('Wed, 21 Oct 2015 07:28:00 GMT')); // 30000
 * parseRetryAfterMs('soon'); // null
 */
export const parseRetryAfterMs = (
  value: string | readonly string[] | null | undefined,
  nowMs: number = Date.now(),
): number | null => {
  const header = (typeof value === 'string' ? value : value?.[0])?.trim();
  if (header === undefined || header === '') {
    return null;
  }
  let waitMs: number;
  if (DELAY_SECONDS_PATTERN.test(header)) {
    waitMs = Number(header) * 1000;
  } else if (HTTP_DATE_PATTERN.test(header) || ASCTIME_DATE_PATTERN.test(header)) {
    const dateMs = Date.parse(ASCTIME_DATE_PATTERN.test(header) ? `${header} GMT` : header);
    if (Number.isNaN(dateMs)) {
      return null;
    }
    waitMs = dateMs - nowMs;
  } else {
    return null;
  }
  return Math.min(Math.max(waitMs, 0), MAX_RETRY_AFTER_MS);
};
