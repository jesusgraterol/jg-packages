import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { createErrorFeedback } from 'jg-exception';

import { ErrorFeedbackProvider } from '../../components/error-feedback-provider/index.js';

// a test consumer owns these codes and copy; no application registry ships with the UI.
export const TEST_ERROR_FEEDBACK_RESOLVER = createErrorFeedback({
  fallbackMessage: 'We could not complete this request. Please try again.',
  messagesByCode: {
    ACCESS_REVOKED: 'You do not have permission to view this content.',
    NETWORK_ERROR: 'We could not reach the service. Please try again in a moment.',
    TIMEOUT: 'The request timed out. Please try again.',
  },
  publicCodePattern: /^(PUBLIC_REQUEST|NETWORK_ERROR|TIMEOUT)$/u,
  accessDeniedCodes: ['ACCESS_REVOKED'],
});

/** Renders a consumer-owned error policy around real query UI components. */
export const renderWithErrorPolicy = (root: Root, children: ReactNode): void => {
  root.render(
    <ErrorFeedbackProvider resolveErrorFeedback={TEST_ERROR_FEEDBACK_RESOLVER}>
      {children}
    </ErrorFeedbackProvider>,
  );
};
