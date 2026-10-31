import { useCallback, type ReactElement } from 'react';

import type { IErrorFeedbackResolver } from '../../contracts/index.js';
import { resolveErrorFeedbackSafely } from '../../shared/error-feedback/index.js';

import { ErrorFeedbackContext } from './error-feedback.context.js';
import type { IErrorFeedbackProviderProps } from './types.js';

/**
 * Scopes application-owned error copy and access-loss policy to a React tree.
 * @param props The optional resolver and children that consume it.
 * @returns The scoped error-feedback context, with stable identity for an unchanged resolver.
 * @example
 * import { createElement } from 'react';
 * import { createErrorFeedback } from 'jg-exception';
 * import { ErrorFeedbackProvider } from 'jg-react-ui/components/error-feedback-provider';
 * const resolver = createErrorFeedback({ fallbackMessage: 'Please try again.' });
 * const example = createElement(ErrorFeedbackProvider, { resolveErrorFeedback: resolver, children: 'App' });
 */
export const ErrorFeedbackProvider = ({
  children,
  resolveErrorFeedback,
}: IErrorFeedbackProviderProps): ReactElement => {
  const resolver = useCallback<IErrorFeedbackResolver>(
    (error, overrides) => resolveErrorFeedbackSafely(error, overrides, resolveErrorFeedback),
    [resolveErrorFeedback],
  );
  return <ErrorFeedbackContext value={resolver}>{children}</ErrorFeedbackContext>;
};
