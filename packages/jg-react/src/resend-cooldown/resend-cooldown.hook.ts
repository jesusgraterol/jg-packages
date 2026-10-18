import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import { RESEND_COOLDOWN_STORE_ID } from './constants.js';
import type { IUseResendCooldownOptions, IUseResendCooldownResult } from './types.js';
import {
  getAdvisoryDeadline,
  getRemainingSeconds,
  readCooldownDeadline,
  saveCooldownDeadline,
  toAttemptedAtMs,
} from './utilities.js';

/**
 * Makes a resend button, such as for a verification email or a one-time code, wait after each
 * send, with a countdown. Call `startCooldown` once the server acknowledged a send. With a
 * `cooldownKey`, the deadline is kept in sessionStorage, so it survives a reload of the tab, and
 * in memory when storage fails. Until the tab sends itself, `lastAttemptedAt`, when the server
 * says the last send happened, sets the deadline; a time in the future counts as now.
 *
 * The first render, on the server and while hydrating, is always `{ isCoolingDown: false,
 * remainingSeconds: 0 }`, and the deadline is read right after mount, before the browser paints.
 * So a server-rendered button looks enabled until hydration, when it can't be clicked anyway.
 * @param options The duration in seconds, and optionally the cooldown's key, the server's last
 * send, and the jg-storage store id.
 * @returns Whether it's cooling down, the seconds left, and `startCooldown`.
 * @example
 * import { useResendCooldown } from 'jg-react';
 *
 * export const useVerificationResend = (accountId: string, lastSentAt: string | null) =>
 *   useResendCooldown({
 *     durationSeconds: 60,
 *     cooldownKey: `${accountId}:verify-email`,
 *     lastAttemptedAt: lastSentAt,
 *   });
 * @throws
 * - INVALID_COOLDOWN_DURATION: The cooldown duration must be a positive safe integer of seconds.
 * - INVALID_STORE_ID: The store id must hold only letters, digits, underscores, and hyphens.
 */
export const useResendCooldown = ({
  durationSeconds,
  cooldownKey,
  lastAttemptedAt,
  storeId = RESEND_COOLDOWN_STORE_ID,
}: IUseResendCooldownOptions): IUseResendCooldownResult => {
  if (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0) {
    throw new Exception('The cooldown duration must be a positive safe integer of seconds.', {
      code: ERRORS.INVALID_COOLDOWN_DURATION,
      data: { durationSeconds: String(durationSeconds) },
    });
  }
  const durationMs = durationSeconds * 1000;
  const attemptedAtMs = toAttemptedAtMs(lastAttemptedAt);
  const [deadlineMs, setDeadlineMs] = useState<number | undefined>(undefined);
  const [nowMs, setNowMs] = useState(0);
  // the deadline this hook started without a key, which only memory holds
  const unkeyedDeadlineMs = useRef<number | undefined>(undefined);

  // after mount, and when the inputs change: a deadline this tab started wins over the server's
  useLayoutEffect(() => {
    const observedAtMs = Date.now();
    const localDeadlineMs =
      cooldownKey === undefined
        ? unkeyedDeadlineMs.current
        : readCooldownDeadline(storeId, cooldownKey, observedAtMs);
    setDeadlineMs(localDeadlineMs ?? getAdvisoryDeadline(attemptedAtMs, durationMs, observedAtMs));
    setNowMs(observedAtMs);
  }, [attemptedAtMs, cooldownKey, durationMs, storeId]);

  const remainingSeconds = getRemainingSeconds(deadlineMs, nowMs);
  const isCoolingDown = remainingSeconds > 0;

  // ticks every second while cooling down, and once more at the exact deadline
  useEffect(() => {
    if (!isCoolingDown || deadlineMs === undefined) {
      return undefined;
    }
    const updateTime = (): void => {
      setNowMs(Date.now());
    };
    const intervalId = window.setInterval(updateTime, 1000);
    const expiryId = window.setTimeout(updateTime, Math.max(0, deadlineMs - Date.now()));
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(expiryId);
    };
  }, [deadlineMs, isCoolingDown]);

  // a hidden tab's timers run late, so the time is read again when it's shown
  useEffect(() => {
    const updateTime = (): void => {
      setNowMs(Date.now());
    };
    document.addEventListener('visibilitychange', updateTime);
    return () => {
      document.removeEventListener('visibilitychange', updateTime);
    };
  }, []);

  const startCooldown = useCallback((): void => {
    const startedAtMs = Date.now();
    const nextDeadlineMs = startedAtMs + durationMs;
    if (cooldownKey === undefined) {
      unkeyedDeadlineMs.current = nextDeadlineMs;
    } else {
      saveCooldownDeadline(storeId, cooldownKey, nextDeadlineMs);
    }
    setDeadlineMs(nextDeadlineMs);
    setNowMs(startedAtMs);
  }, [cooldownKey, durationMs, storeId]);

  return useMemo(
    () => ({ isCoolingDown, remainingSeconds, startCooldown }),
    [isCoolingDown, remainingSeconds, startCooldown],
  );
};
