import type { IRouteLoadErrorMessage } from './types.js';

/** What a page whose code a newer build replaced says.
 * @see RouteLoadError
 */
export const ROUTE_LOAD_ERROR_UPDATED_MESSAGE: IRouteLoadErrorMessage = {
  title: 'The app was updated',
  description:
    "This page changed with the update, so it opens once the app reloads. Anything you haven't saved yet is cleared.",
};

/** What a page whose code can't be fetched offline says.
 * @see RouteLoadError
 */
export const ROUTE_LOAD_ERROR_OFFLINE_MESSAGE: IRouteLoadErrorMessage = {
  title: "You're offline",
  description:
    "This page opens once you're back online and the app reloads. Anything you haven't saved yet is cleared.",
};

/** The action that reloads the app.
 * @see RouteLoadError
 */
export const ROUTE_LOAD_ERROR_RELOAD_LABEL = 'Reload';
