import type { ReactNode } from 'react';

import type { IErrorFeedbackResolver } from '../../contracts/index.js';

/** Scoped application policy and its rendered children.
 * @see ErrorFeedbackProvider
 */
export type IErrorFeedbackProviderProps = {
  children: ReactNode;
  resolveErrorFeedback?: IErrorFeedbackResolver;
};
