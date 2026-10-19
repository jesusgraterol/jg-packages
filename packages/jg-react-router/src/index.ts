// types
export type {
  IDialogNavigationDismissalOptions,
  IDialogNavigationObserverProps,
  IDialogNavigationProviderProps,
  IDialogNavigationSessionReader,
} from './dialog-navigation/index.js';
export type { IPageOutletProps } from './page-outlet/index.js';
export type {
  ICreatePageRouteObjectOptions,
  IPageRouteComponentProps,
  IPageRouteDefinition,
  IPageRouteHandle,
  IPageRouteLazyFunction,
  IPageRouteMetadata,
} from './page-route/index.js';

// page outlet
export { PageOutlet } from './page-outlet/index.js';

// dialog navigation
export {
  DialogNavigationObserver,
  DialogNavigationProvider,
  useDialogNavigationDismissal,
} from './dialog-navigation/index.js';

// page routes
export {
  createLazyPageComponent,
  createPageRouteElement,
  createPageRouteHandle,
  createPageRouteMetadata,
  createPageRouteObject,
  usePageRouteMetadata,
} from './page-route/index.js';
