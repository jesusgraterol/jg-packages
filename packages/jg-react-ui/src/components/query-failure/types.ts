import type { IQueryErrorAlertProps } from '../query-error-alert/index.js';

/** Options for QueryFailure: what QueryBoundary hands its error alert, and the offline note.
 * @see QueryFailure
 */
export type IQueryFailureProps = IQueryErrorAlertProps & {
  // what shows above the alert while the browser is offline
  offlineMessage?: string;
};
