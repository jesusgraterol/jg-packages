// what the TSDoc examples use but don't define; release check 8 typechecks them with it, and it
// never ships

// the page's buttons and banner
declare const installButton: HTMLButtonElement;
declare const updateButton: HTMLButtonElement;
declare const showUpdateBanner: () => void;

// React's hook, which the examples call from a component
declare const useSyncExternalStore: <T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
) => T;
