// types
export type {
  ICreatePageRouteObjectOptions,
  IPageRouteComponentProps,
  IPageRouteDefinition,
  IPageRouteHandle,
  IPageRouteLazyFunction,
  IPageRouteMetadata,
} from './types.js';

// route objects
export {
  createLazyPageComponent,
  createPageRouteElement,
  createPageRouteHandle,
  createPageRouteMetadata,
  createPageRouteObject,
} from './utilities.js';

// hooks
export { usePageRouteMetadata } from './page-route-metadata.hook.js';
