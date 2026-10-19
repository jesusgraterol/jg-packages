// types
export type {
  IDialogNavigationDismissalOptions,
  IDialogNavigationObserverProps,
  IDialogNavigationProviderProps,
  IDialogNavigationSessionReader,
} from './dialog-navigation/index.js';
export type { IPageOutletProps } from './page-outlet/index.js';
export type {
  IPageReturn,
  IPageReturnOptions,
  IPageReturnOrigin,
  IPageReturnResolution,
  IResolvePageReturnOptions,
  IRetainedSearchParamRule,
} from './page-return/index.js';
export type {
  ICreatePageRouteObjectOptions,
  IPageRouteComponentProps,
  IPageRouteDefinition,
  IPageRouteHandle,
  IPageRouteLazyFunction,
  IPageRouteMetadata,
} from './page-route/index.js';
export type {
  ISearchParamKind,
  ISearchParamKinds,
  ISetSearchParamState,
  ISetSearchParamStateOptions,
  IUseSearchParamStateOptions,
} from './search-param-state/index.js';
export type { ISchema } from './shared/index.js';

// error codes
export { ERRORS } from './shared/index.js';

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

// URL state
export { useSearchParamState } from './search-param-state/index.js';

// page returns
export {
  createPageReturn,
  DEFAULT_PAGE_RETURN_STATE_KEY,
  retainSearchParams,
  usePageReturn,
} from './page-return/index.js';
