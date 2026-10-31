import type {
  IDialogNavigationDismissalOptions as IRouterDialogNavigationDismissalOptions,
  IDialogNavigationObserverProps as IRouterDialogNavigationObserverProps,
  IDialogNavigationProviderProps as IRouterDialogNavigationProviderProps,
  IDialogNavigationSessionReader as IRouterDialogNavigationSessionReader,
} from 'jg-react-router';

/**
 * Reads an opaque session identity that stays stable until the dialog closes.
 * @see useDialogNavigationDismissal
 */
export type IDialogNavigationSessionReader = IRouterDialogNavigationSessionReader;

/**
 * Registers the current session identity and synchronous navigation cancellation.
 * @see useDialogNavigationDismissal
 */
export type IDialogNavigationDismissalOptions = IRouterDialogNavigationDismissalOptions;

/**
 * Shares navigation dismissal between a router and its persistent dialog hosts.
 * @see DialogNavigationProvider
 */
export type IDialogNavigationProviderProps = IRouterDialogNavigationProviderProps;

/**
 * Marks a committed root error screen while observing router location changes.
 * @see DialogNavigationObserver
 */
export type IDialogNavigationObserverProps = IRouterDialogNavigationObserverProps;
