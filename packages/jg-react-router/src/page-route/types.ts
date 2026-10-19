import type { ComponentType, ReactElement } from 'react';
import type { RouteObject } from 'react-router';

// a page's title and description, kept with its route
export type IPageRouteMetadata = {
  title: string;
  description: string;
};

// the handle a page route carries, which usePageRouteMetadata reads from the matches
export type IPageRouteHandle = {
  pageMetadata: IPageRouteMetadata;
};

// the props a page component receives: exactly its route's title and description
export type IPageRouteComponentProps = IPageRouteMetadata;

// loads a page component on demand, such as from a dynamic import
export type IPageRouteLazyFunction = () => Promise<{
  Component: ComponentType<IPageRouteComponentProps>;
}>;

/*
 * A page route's definition: its path, title, and description, any fields an app adds, such as a
 * navigation label, and either its component or a function that loads it.
 */
export type IPageRouteDefinition<TExtraFields extends object = object> = IPageRouteMetadata &
  TExtraFields & { path: string } & (
    | { Component: ComponentType<IPageRouteComponentProps>; lazy?: never }
    | { Component?: never; lazy: IPageRouteLazyFunction }
  );

// what createPageRouteObject takes besides the definition
export type ICreatePageRouteObjectOptions = {
  // shown while a lazy page loads during hydration
  HydrateFallback?: RouteObject['HydrateFallback'] | undefined;

  // wraps every page's element, such as in a layout or an error boundary
  wrapElement?:
    ((element: ReactElement, pageMetadata: IPageRouteMetadata) => ReactElement) | undefined;
};
