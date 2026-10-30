import { createErrorFeedback } from 'jg-exception';

// unknown diagnostics and codes remain private; applications opt in to authored code mappings
export const DEFAULT_ERROR_FEEDBACK_RESOLVER = createErrorFeedback({
  fallbackMessage: 'Something went wrong. Please try again.',
});
