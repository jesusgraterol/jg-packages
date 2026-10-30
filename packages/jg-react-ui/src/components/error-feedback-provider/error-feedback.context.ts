import { createContext } from 'react';

import type { IErrorFeedbackResolver } from '../../contracts/index.js';
import { DEFAULT_ERROR_FEEDBACK_RESOLVER } from '../../shared/error-feedback/index.js';

// a missing provider uses generic authored copy without exposing diagnostic text
export const ErrorFeedbackContext = createContext<IErrorFeedbackResolver>(
  DEFAULT_ERROR_FEEDBACK_RESOLVER,
);
