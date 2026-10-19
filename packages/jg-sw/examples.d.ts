// what the TSDoc examples use but don't define; release check 8 typechecks them with it, and it
// never ships

// the page's buttons, banner, and Add to Home Screen hint
declare const installButton: HTMLButtonElement;
declare const updateButton: HTMLButtonElement;
declare const showUpdateBanner: () => void;
declare const homeScreenHint: HTMLElement;

// React's hook, which the examples call from a component
declare const useSyncExternalStore: <T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
) => T;
