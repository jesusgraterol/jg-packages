import { type ComponentType, createElement, type ReactElement } from 'react';
import type { RouteObject } from 'react-router';

import type {
  ICreatePageRouteObjectOptions,
  IPageRouteComponentProps,
  IPageRouteDefinition,
  IPageRouteHandle,
  IPageRouteLazyFunction,
  IPageRouteMetadata,
} from './types.js';

/**
 * Picks a page's title and description from its route definition, leaving out every other field.
 * @param pageRoute The definition, or anything with a title and a description.
 * @returns The metadata.
 * @example
 * import { createPageRouteMetadata } from 'jg-react-router';
 *
 * const settings = { path: '/settings', title: 'Settings', description: 'Your account.' };
 * createPageRouteMetadata(settings); // { title: 'Settings', description: 'Your account.' }
 */
export const createPageRouteMetadata = ({
  title,
  description,
}: IPageRouteMetadata): IPageRouteMetadata => ({ title, description });

/**
 * Creates the handle a page route carries, which usePageRouteMetadata reads.
 * @param pageMetadata The page's title and description.
 * @returns The handle.
 * @example
 * import { createPageRouteHandle } from 'jg-react-router';
 *
 * const handle = createPageRouteHandle({ title: 'Settings', description: 'Your account.' });
 */
export const createPageRouteHandle = (pageMetadata: IPageRouteMetadata): IPageRouteHandle => ({
  pageMetadata,
});

/**
 * Renders a page component with its title and description as its props.
 * @param PageComponent The component.
 * @param pageMetadata The title and description.
 * @returns The element.
 * @example
 * import { createPageRouteElement, type IPageRouteComponentProps } from 'jg-react-router';
 *
 * declare const SettingsPage: (props: IPageRouteComponentProps) => null;
 *
 * const element = createPageRouteElement(SettingsPage, { title: 'Settings', description: 'Your account.' });
 */
export const createPageRouteElement = (
  PageComponent: ComponentType<IPageRouteComponentProps>,
  pageMetadata: IPageRouteMetadata,
): ReactElement => createElement(PageComponent, createPageRouteMetadata(pageMetadata));

/**
 * Turns a dynamic import of a module whose default export is a page component into a page
 * route's `lazy` function, so the page's code loads only when its route is visited.
 * @param loadModule Imports the page's module.
 * @returns The lazy function.
 * @example
 * import { createLazyPageComponent } from 'jg-react-router';
 *
 * declare const importSettings: Parameters<typeof createLazyPageComponent>[0];
 *
 * const lazy = createLazyPageComponent(importSettings); // such as () => import('./settings.page.js')
 */
export const createLazyPageComponent =
  (
    loadModule: () => Promise<{ default: ComponentType<IPageRouteComponentProps> }>,
  ): IPageRouteLazyFunction =>
  async () => ({ Component: (await loadModule()).default });

/**
 * Turns a page route's definition into a React Router route object: the page's element, with its
 * title and description as its props, under a handle that usePageRouteMetadata reads. An eager
 * route renders its component; a lazy one loads it when visited, with `HydrateFallback` shown
 * while it loads during hydration. `wrapElement` wraps the element either way.
 * @param pageRoute The definition.
 * @param options The fallback for lazy routes, and the wrapper for every element.
 * @returns The route object.
 * @example
 * import { createBrowserRouter } from 'react-router';
 * import { createLazyPageComponent, createPageRouteObject } from 'jg-react-router';
 *
 * declare const importSettings: Parameters<typeof createLazyPageComponent>[0];
 *
 * export const router = createBrowserRouter([
 *   createPageRouteObject({
 *     path: '/settings',
 *     title: 'Settings',
 *     description: 'Your account and notifications.',
 *     lazy: createLazyPageComponent(importSettings),
 *   }),
 * ]);
 */
export const createPageRouteObject = <TExtraFields extends object>(
  pageRoute: IPageRouteDefinition<TExtraFields>,
  { HydrateFallback, wrapElement = (element) => element }: ICreatePageRouteObjectOptions = {},
): RouteObject => {
  const pageMetadata = createPageRouteMetadata(pageRoute);
  const handle = createPageRouteHandle(pageMetadata);
  if (pageRoute.lazy === undefined) {
    return {
      path: pageRoute.path,
      handle,
      element: wrapElement(createPageRouteElement(pageRoute.Component, pageMetadata), pageMetadata),
    };
  }
  const { lazy } = pageRoute;
  return {
    path: pageRoute.path,
    handle,
    ...(HydrateFallback === undefined ? {} : { HydrateFallback }),
    lazy: async () => {
      const { Component } = await lazy();
      return {
        element: wrapElement(createPageRouteElement(Component, pageMetadata), pageMetadata),
      };
    },
  };
};
