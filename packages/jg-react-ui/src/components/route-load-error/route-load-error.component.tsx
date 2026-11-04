import type * as React from 'react';
import { useRouteError } from 'react-router';
import { cn } from 'cnfast';
import { hasErrorCode } from 'jg-exception';
import { useOnlineStatus } from 'jg-react';
import { ERRORS } from 'jg-react-router';

import { Button } from '../button/index.js';
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from '../empty-state/index.js';
import { Illustration } from '../illustration/index.js';
import { PageShell } from '../layout/index.js';

import {
  ROUTE_LOAD_ERROR_OFFLINE_MESSAGE,
  ROUTE_LOAD_ERROR_RELOAD_LABEL,
  ROUTE_LOAD_ERROR_UPDATED_MESSAGE,
} from './constants.js';
import type { IRouteLoadErrorProps } from './types.js';

/**
 * Renders a route's error element for a page whose code couldn't be loaded, which
 * jg-react-router's loadRouteModule and createLazyRoute reject with ROUTE_MODULE_UNAVAILABLE: after
 * a deploy replaced the scripts the open build names, it says the page opens once the app
 * reloads, and offline that it opens once the browser is back online, with Reload either way. It
 * never reloads on its own, since that clears what the user hasn't saved. Any other error goes on
 * to the next error boundary. Place it as the `errorElement` of a pathless route that groups the
 * lazy pages inside the app's layout, so the layout's navigation stays.
 * @param props The app's name for the document's title, the copy, and what Reload does.
 * @returns A React element that renders the notice.
 * @example
 * import { createElement } from 'react';
 * import { RouteLoadError } from 'jg-react-ui/components/route-load-error';
 * const errorElement = createElement(RouteLoadError, {
 *   appName: 'Acme',
 *   onReload: () => window.location.reload(),
 * });
 * @throws
 * - The route's error, when it isn't ROUTE_MODULE_UNAVAILABLE.
 */
export const RouteLoadError = ({
  appName,
  messages,
  onReload,
  className,
}: IRouteLoadErrorProps): React.ReactElement => {
  const error = useRouteError();
  const isOnline = useOnlineStatus();
  if (!hasErrorCode(error, ERRORS.ROUTE_MODULE_UNAVAILABLE)) {
    throw error;
  }
  const { title, description } = isOnline
    ? (messages?.updated ?? ROUTE_LOAD_ERROR_UPDATED_MESSAGE)
    : (messages?.offline ?? ROUTE_LOAD_ERROR_OFFLINE_MESSAGE);
  return (
    <PageShell
      data-slot="route-load-error"
      className={cn('mx-auto w-full max-w-4xl', className)}
    >
      <title>{appName === undefined ? title : `${title} · ${appName}`}</title>
      <EmptyState>
        {isOnline ? null : <Illustration name="offline" />}
        <EmptyStateTitle>{title}</EmptyStateTitle>
        <EmptyStateDescription>{description}</EmptyStateDescription>
        <Button
          size="touch"
          type="button"
          onClick={onReload}
        >
          {messages?.reload ?? ROUTE_LOAD_ERROR_RELOAD_LABEL}
        </Button>
      </EmptyState>
    </PageShell>
  );
};
