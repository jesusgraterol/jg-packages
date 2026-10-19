import type { ReactNode } from 'react';

// reads a dialog's open session: a stable object for as long as that session lasts, or null while
// the dialog is closed
export type IDialogNavigationSessionReader = () => object | null;

// what useDialogNavigationDismissal takes: how to read the dialog's session, and how to close it,
// which must happen synchronously
export type IDialogNavigationDismissalOptions = {
  getSession: IDialogNavigationSessionReader;
  onDismiss: () => void;
};

// what DialogNavigationProvider takes: the router and the dialog hosts that share its navigation
export type IDialogNavigationProviderProps = {
  children?: ReactNode;
};

// what DialogNavigationObserver takes
export type IDialogNavigationObserverProps = {
  // whether the observer belongs to the root error screen, which replaces the route without
  // changing its location key
  isErrorScreen?: boolean | undefined;
};

// a committed location as the observer reports it
export type IDialogNavigationLocation = {
  key: string;
  isErrorScreen: boolean;
};

// what the provider shares: stable for the provider's lifetime
export type IDialogNavigationContext = {
  register: (options: IDialogNavigationDismissalOptions) => () => void;
  observe: (location: IDialogNavigationLocation) => void;
};
