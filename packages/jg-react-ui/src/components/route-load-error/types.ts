/** What a page whose code couldn't load says: its title and description, online after an update
 * and offline.
 * @see RouteLoadError
 */
export type IRouteLoadErrorMessage = {
  title: string;
  description: string;
};

/** The copy RouteLoadError shows; each part falls back to the default.
 * @see RouteLoadError
 */
export type IRouteLoadErrorMessages = {
  updated?: IRouteLoadErrorMessage;
  offline?: IRouteLoadErrorMessage;
  reload?: string;
};

/** Options for RouteLoadError.
 * @see RouteLoadError
 */
export type IRouteLoadErrorProps = {
  // the app's name, which the document's title ends with, such as `Not found · Acme`
  appName?: string;
  messages?: IRouteLoadErrorMessages;
  // what Reload does, such as `() => window.location.reload()`, as GlobalErrorBoundary's refresh
  onReload: () => void;
  className?: string;
};
