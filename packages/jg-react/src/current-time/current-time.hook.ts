import { useEffect, useState } from 'react';
import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import type { IUseCurrentTimeOptions } from './types.js';

/**
 * Keeps the current time for labels that read relative to it, such as "5 minutes ago", moving it
 * on once an interval, a minute by default, so they change without re-rendering every second.
 * The first render reads the time it renders at, which a server render reads too.
 * @param options How often the time moves on, in seconds.
 * @returns The current time, in Unix milliseconds.
 * @example
 * import { useCurrentTime } from 'jg-react';
 * import { formatRelativeTime } from 'jg-utilities';
 *
 * export const useObservedLabel = (observedAt: number) =>
 *   `Observed ${formatRelativeTime(observedAt, { now: useCurrentTime() })}`;
 * @throws
 * - INVALID_CURRENT_TIME_INTERVAL: The current time's interval must be a positive, finite number of seconds.
 */
export const useCurrentTime = ({ intervalSeconds = 60 }: IUseCurrentTimeOptions = {}): number => {
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new Exception(
      "The current time's interval must be a positive, finite number of seconds.",
      {
        code: ERRORS.INVALID_CURRENT_TIME_INTERVAL,
        data: { intervalSeconds: String(intervalSeconds) },
      },
    );
  }
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, intervalSeconds * 1000);
    return () => {
      clearInterval(timer);
    };
  }, [intervalSeconds]);
  return now;
};
