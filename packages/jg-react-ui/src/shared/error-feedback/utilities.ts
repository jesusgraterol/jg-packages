import type { IErrorFeedback, IErrorFeedbackOverrides } from 'jg-exception';

import type { IErrorFeedbackResolver } from '../../contracts/index.js';

import { DEFAULT_ERROR_FEEDBACK_RESOLVER } from './constants.js';

/**
 * Applies a scoped application policy with safe fallback and cancellation handling.
 * @param error The failure to present without exposing its diagnostic message.
 * @param overrides Authored copy overrides for this operation.
 * @param resolver The application policy, when one is configured.
 * @returns Safe feedback; a throwing resolver falls back to the package policy.
 */
export const resolveErrorFeedbackSafely = (
  error: unknown,
  overrides?: IErrorFeedbackOverrides,
  resolver: IErrorFeedbackResolver = DEFAULT_ERROR_FEEDBACK_RESOLVER,
): IErrorFeedback => {
  const fallback = DEFAULT_ERROR_FEEDBACK_RESOLVER(error, overrides);
  if (fallback.isCancelled || resolver === DEFAULT_ERROR_FEEDBACK_RESOLVER) return fallback;
  try {
    return resolver(error, overrides);
  } catch {
    return fallback;
  }
};
