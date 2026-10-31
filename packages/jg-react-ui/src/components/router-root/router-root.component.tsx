import { type ReactElement } from 'react';
import { Outlet, useNavigation } from 'react-router';

import { LazyRouteProgress } from '../lazy-route-progress/index.js';
import { DialogNavigationObserver } from '../dialog-navigation/index.js';

/**
 * Renders the route outlet with fixed top progress feedback during pending navigations.
 * @returns A React element that renders global router loading feedback and the matched route.
 * @example
 * import { createElement } from 'react';
 * import { createBrowserRouter } from 'react-router';
 * import { RouterRoot } from 'jg-react-ui/components/router-root';
 * const router = createBrowserRouter([{ element: createElement(RouterRoot), children: [{ path: '/', element: 'Home' }] }]);
 */
export const RouterRoot = (): ReactElement => {
  const navigation = useNavigation();
  const hasPendingNavigation = navigation.location !== undefined;

  return (
    <>
      <DialogNavigationObserver />
      {hasPendingNavigation ? <LazyRouteProgress /> : null}
      <Outlet />
    </>
  );
};
