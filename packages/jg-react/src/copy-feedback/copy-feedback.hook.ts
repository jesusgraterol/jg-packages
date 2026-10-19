import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import { DEFAULT_COPY_FEEDBACK_SECONDS } from './constants.js';
import type { IUseCopyFeedbackOptions, IUseCopyFeedbackResult } from './types.js';

/**
 * Shows that a copy worked, for a moment, such as a "Copied" label on a copy button. `copy` calls
 * the write function at once, before it awaits anything, so a clipboard write still runs inside
 * the click that browsers require; then `isCopied` stays true for `durationSeconds`. A copy while
 * another runs is ignored, and a failed one calls `onError` and leaves `isCopied` false. `copy`
 * never rejects, and after unmount nothing changes and nothing is called.
 * @param options How long the copied state lasts, and what receives a failed copy's error.
 * @returns Whether a copy just succeeded, and `copy`, which keeps its identity.
 * @example
 * import { useCopyFeedback } from 'jg-react';
 *
 * export const useCopyLink = (url: string) => {
 *   const { isCopied, copy } = useCopyFeedback();
 *   return { isCopied, copyLink: () => copy(() => navigator.clipboard.writeText(url)) };
 * };
 * @throws
 * - INVALID_COPY_FEEDBACK_DURATION: The copy feedback duration must be a positive, finite number of seconds.
 */
export const useCopyFeedback = ({
  durationSeconds = DEFAULT_COPY_FEEDBACK_SECONDS,
  onError,
}: IUseCopyFeedbackOptions = {}): IUseCopyFeedbackResult => {
  if (
    typeof durationSeconds !== 'number' ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    throw new Exception(
      'The copy feedback duration must be a positive, finite number of seconds.',
      {
        code: ERRORS.INVALID_COPY_FEEDBACK_DURATION,
        data: { durationSeconds: String(durationSeconds) },
      },
    );
  }
  const durationMs = durationSeconds * 1000;
  const [isCopied, setIsCopied] = useState(false);
  const isCopying = useRef(false);
  const isMounted = useRef(false);
  const resetTimeoutId = useRef<number | undefined>(undefined);

  // the latest onError, so copy keeps its identity when the caller passes a new function
  const latestOnError = useRef(onError);
  useLayoutEffect(() => {
    latestOnError.current = onError;
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      window.clearTimeout(resetTimeoutId.current);
      resetTimeoutId.current = undefined;
    };
  }, []);

  const copy = useCallback(
    async (write: () => unknown): Promise<boolean> => {
      if (isCopying.current || !isMounted.current) {
        return false;
      }
      isCopying.current = true;
      window.clearTimeout(resetTimeoutId.current);
      resetTimeoutId.current = undefined;
      try {
        // write runs before this await suspends, within the click that called copy
        await write();
        if (isMounted.current) {
          setIsCopied(true);
          resetTimeoutId.current = window.setTimeout(() => {
            resetTimeoutId.current = undefined;
            setIsCopied(false);
          }, durationMs);
        }
        return true;
      } catch (error) {
        if (isMounted.current) {
          setIsCopied(false);
          latestOnError.current?.(error);
        }
        return false;
      } finally {
        isCopying.current = false;
      }
    },
    [durationMs],
  );

  return useMemo(() => ({ isCopied, copy }), [copy, isCopied]);
};
