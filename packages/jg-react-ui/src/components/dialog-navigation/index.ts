// shared navigation contracts
export type {
  IDialogNavigationDismissalOptions,
  IDialogNavigationObserverProps,
  IDialogNavigationProviderProps,
  IDialogNavigationSessionReader,
} from './types.js';

// shared provider, observer, and registration hook
export {
  DialogNavigationObserver,
  DialogNavigationProvider,
  useDialogNavigationDismissal,
} from 'jg-react-router';
