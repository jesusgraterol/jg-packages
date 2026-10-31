import { useContext } from 'react';

import type { IErrorFeedbackResolver } from '../../contracts/index.js';

import { ErrorFeedbackContext } from './error-feedback.context.js';

/**
 * Reads the nearest safe error-feedback resolver, or the generic default outside a provider.
 * @returns The resolver for this React tree.
 * @example
 * import { useErrorFeedbackResolver } from 'jg-react-ui/components/error-feedback-provider';
 * const ErrorNotice = () => {
 *   const resolveErrorFeedback = useErrorFeedbackResolver();
 *   return resolveErrorFeedback(new Error('Private diagnostics')).message;
 * };
 */
export const useErrorFeedbackResolver = (): IErrorFeedbackResolver =>
  useContext(ErrorFeedbackContext);
