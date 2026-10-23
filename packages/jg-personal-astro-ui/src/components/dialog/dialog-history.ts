// the marker preserves the router's fields and its exact original state without nesting markers
const HISTORY_KEY = '__jgPersonalAstroDialog';
const HISTORY_EVENT = 'jg:dialog-history-pop';
interface IHistoryMarker {
  token: string;
  url: string;
  base: unknown;
}

/**
 * Installs the synchronous relay before deferred routers register their popstate handlers.
 * The document survives Astro swaps, and the window symbol prevents duplicate relays.
 * @returns The component's small inline bootstrap.
 */
export const buildDialogHistoryBootstrap = (): string => `(() => {
  const key = Symbol.for('jg:ui-dialog-history');
  if (window[key]) return;
  window[key] = true;
  window.addEventListener('popstate', (event) => {
    document.dispatchEvent(new CustomEvent(${JSON.stringify(HISTORY_EVENT)}, { detail: event }));
  }, true);
})();`;

/** Reads only this component's history marker; other state remains opaque. */
const readMarker = (state: unknown): IHistoryMarker | undefined => {
  if (state === null || typeof state !== 'object' || !(HISTORY_KEY in state)) return undefined;
  const marker = state[HISTORY_KEY] as Partial<IHistoryMarker> | null;
  return marker !== null &&
    typeof marker === 'object' &&
    typeof marker.token === 'string' &&
    typeof marker.url === 'string' &&
    Object.hasOwn(marker, 'base')
    ? (marker as IHistoryMarker)
    : undefined;
};

/**
 * Owns same-URL entries for phone fullscreen openings. Traversals close only entries actually
 * left behind; stale Forward entries never reopen a dialog. A pending Back serializes the next
 * opening so a rapid reopen cannot have its new entry consumed by an earlier close.
 * @param view The owning window.
 * @param close Closes a dialog synchronously, including its owned resources.
 * @returns The document's small history boundary.
 */
export const createDialogHistory = (view: Window, close: (dialog: HTMLDialogElement) => void) => {
  const entries = new Map<HTMLDialogElement, { token: string; url: string }>();
  let pendingUrl: string | undefined;
  let nextOpening: (() => void) | undefined;
  view.document.addEventListener(HISTORY_EVENT, (relayed) => {
    const event = (relayed as CustomEvent<PopStateEvent>).detail;
    const marker = readMarker(view.history.state);
    const url = view.location.href;
    if (
      pendingUrl === url ||
      marker?.url === url ||
      [...entries.values()].some((entry) => entry.url === url && entry.token !== marker?.token)
    )
      event.stopImmediatePropagation();
    const previousUrl = pendingUrl;
    pendingUrl = undefined;
    for (const [dialog, entry] of [...entries].reverse()) {
      if (marker?.token === entry.token && view.location.href === entry.url) break;
      entries.delete(dialog);
      close(dialog);
    }
    if (
      marker !== undefined &&
      ![...entries.values()].some((entry) => entry.token === marker.token)
    )
      view.history.replaceState(marker.base, '');
    const open = nextOpening;
    nextOpening = undefined;
    if (previousUrl === url) open?.();
  });
  return {
    whenReady: (open: () => void): void => {
      if (pendingUrl !== undefined) nextOpening = open;
      else open();
    },
    add: (dialog: HTMLDialogElement): void => {
      if (
        dialog.dataset['dialogMobilePresentation'] !== 'fullscreen' ||
        !view.matchMedia('(width < 40rem)').matches
      )
        return;
      const state: unknown = view.history.state;
      const previous = readMarker(state);
      const base = previous === undefined ? state : previous.base;
      const token = view.crypto.getRandomValues(new Uint32Array(4)).join('-');
      const fields = base !== null && typeof base === 'object' ? base : {};
      view.history.pushState(
        { ...fields, [HISTORY_KEY]: { token, url: view.location.href, base } },
        '',
      );
      entries.set(dialog, { token, url: view.location.href });
    },
    remove: (dialog: HTMLDialogElement): void => {
      const entry = entries.get(dialog);
      entries.delete(dialog);
      if (
        entry !== undefined &&
        readMarker(view.history.state)?.token === entry.token &&
        view.location.href === entry.url
      ) {
        pendingUrl = entry.url;
        view.history.back();
      }
    },
    clear: (): void => {
      const marker = readMarker(view.history.state);
      if (
        marker !== undefined &&
        [...entries.values()].some((entry) => entry.token === marker.token)
      )
        view.history.replaceState(marker.base, '');
      entries.clear();
      pendingUrl = undefined;
      nextOpening = undefined;
    },
  };
};
