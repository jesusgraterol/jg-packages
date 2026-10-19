import { type ReactElement, useContext, useLayoutEffect } from 'react';
import { useLocation } from 'react-router';

import { DialogNavigationContext } from './dialog-navigation.context.js';
import type { IDialogNavigationContext, IDialogNavigationObserverProps } from './types.js';

/**
 * Reports each committed location to the provider, which is only rendered inside one.
 * @param props Whether it belongs to the error screen, and the provider's observe.
 * @returns Nothing.
 */
const ActiveNavigationObserver = ({
  observe,
  isErrorScreen = false,
}: IDialogNavigationObserverProps & Pick<IDialogNavigationContext, 'observe'>): null => {
  const { key } = useLocation();

  useLayoutEffect(() => {
    observe({ key, isErrorScreen });
  }, [key, isErrorScreen, observe]);

  return null;
};

/**
 * Reports each committed navigation to the surrounding DialogNavigationProvider, in a layout
 * effect, so open dialogs close before the new page's effects open its own. Render it once in the
 * router's root route, and with `isErrorScreen` in its error element, so a route error closes the
 * dialogs too. Outside a provider, it renders nothing and needs no router.
 * @param props Whether it belongs to the root error screen.
 * @returns The observer, or null outside a provider.
 * @example
 * import { createElement } from 'react';
 * import { createBrowserRouter, Outlet } from 'react-router';
 * import { DialogNavigationObserver } from 'jg-react-router';
 *
 * export const router = createBrowserRouter([
 *   {
 *     path: '/',
 *     element: createElement('div', null, createElement(DialogNavigationObserver), createElement(Outlet)),
 *     errorElement: createElement(DialogNavigationObserver, { isErrorScreen: true }),
 *   },
 * ]);
 */
export const DialogNavigationObserver = (
  props: IDialogNavigationObserverProps,
): ReactElement | null => {
  const context = useContext(DialogNavigationContext);
  return context === null ? null : (
    <ActiveNavigationObserver
      {...props}
      observe={context.observe}
    />
  );
};
