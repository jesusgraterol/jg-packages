import type { ComponentType } from 'react';
import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import type { ILazyRoute, IRouteModuleLoader } from './types.js';

/**
 * Builds the exception for a route module that couldn't be loaded.
 * @param cause Why the import failed, if it did.
 * @returns The ROUTE_MODULE_UNAVAILABLE exception.
 */
const moduleUnavailable = (cause?: unknown): Exception =>
  new Exception("The page's code couldn't be loaded.", {
    code: ERRORS.ROUTE_MODULE_UNAVAILABLE,
    severity: 'expected',
    ...(cause === undefined ? {} : { cause }),
  });

/**
 * Loads a route's module, telling a failed load apart from the page's own errors, so the route's
 * error element can offer a reload instead of crashing: after a deploy, the scripts the open
 * app's build names are gone, and offline they can't be fetched. A failed import rejects with
 * ROUTE_MODULE_UNAVAILABLE, keeping the failure as its cause, and so does an import that resolves
 * with no module, which Vite does once a `vite:preloadError` handler prevented the error.
 * @param load What imports the module.
 * @returns A promise that resolves to the module.
 * @example
 * import { loadRouteModule } from 'jg-react-router';
 *
 * declare const importSettings: () => Promise<{ SettingsPage: () => null }>;
 *
 * export const loadSettings = () => loadRouteModule(importSettings);
 * @throws
 * - ROUTE_MODULE_UNAVAILABLE: The page's code couldn't be loaded.
 */
export const loadRouteModule = async <TModule extends object>(
  load: IRouteModuleLoader<TModule>,
): Promise<TModule> => {
  let module: TModule | undefined;
  try {
    module = await load();
  } catch (error) {
    throw moduleUnavailable(error);
  }
  if (module === undefined) {
    throw moduleUnavailable();
  }
  return module;
};

/**
 * Builds a route's `lazy` function from its module and the component it exports by name, loading
 * the module through loadRouteModule, so a module that couldn't be loaded rejects with
 * ROUTE_MODULE_UNAVAILABLE for the route's error element.
 * @param load What imports the module.
 * @param select Picks the route's component from the module.
 * @returns The route's `lazy` function.
 * @example
 * import { createBrowserRouter } from 'react-router';
 * import { createLazyRoute } from 'jg-react-router';
 *
 * declare const importSettings: () => Promise<{ SettingsPage: () => null }>;
 *
 * export const router = createBrowserRouter([
 *   { path: '/settings', lazy: createLazyRoute(importSettings, (module) => module.SettingsPage) },
 * ]);
 * @throws
 * - ROUTE_MODULE_UNAVAILABLE: The page's code couldn't be loaded.
 */
export const createLazyRoute =
  <TModule extends object, TProps extends object = object>(
    load: IRouteModuleLoader<TModule>,
    select: (module: TModule) => ComponentType<TProps>,
  ): ILazyRoute<TProps> =>
  async () => ({ Component: select(await loadRouteModule(load)) });
