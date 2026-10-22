import { closeDialog, openDialog } from '../dialog/dialog-behavior.ts';

// what a Pagefind result's data holds that the dialog shows
export type IPagefindResultData = {
  // an HTML snippet around the match, with the matched words in <mark>
  excerpt: string;
  meta: { title?: string | undefined };
  url: string;
};

// the part of Pagefind's JavaScript API the dialog uses
export type IPagefind = {
  search: (query: string) => Promise<{
    results: readonly { data: () => Promise<IPagefindResultData> }[];
  } | null>;
};

// one result the dialog lists
export type ISearchResult = { excerpt: string; title: string; url: string };

// loads Pagefind from its path, such as '/pagefind/pagefind.js'
export type IPagefindLoader = (path: string) => Promise<IPagefind>;

// the most results the dialog lists
export const MAX_SEARCH_RESULTS = 8;

// how long the dialog waits after the last keystroke before it searches
export const SEARCH_DELAY_MS = 150;

/**
 * Checks whether a key event's target takes text, where `/` is typed rather than a shortcut.
 * @param target The event's target.
 * @returns Whether it's a text field, a select, or editable content.
 */
const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as Partial<HTMLElement> | null;
  return (
    element?.isContentEditable === true ||
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(element?.tagName ?? '')
  );
};

/**
 * Checks whether a key press opens search: Ctrl+K or Cmd+K anywhere, or `/` outside a text field.
 * @param event The key press.
 * @returns Whether it's the search shortcut.
 */
export const isSearchShortcut = (event: KeyboardEvent): boolean => {
  if (event.defaultPrevented || event.altKey) {
    return false;
  }
  if (event.metaKey || event.ctrlKey) {
    return event.key.toLowerCase() === 'k';
  }
  return event.key === '/' && !isTypingTarget(event.target);
};

/**
 * Keeps only the `<mark>` tags of a Pagefind excerpt, which is HTML whose text Pagefind already
 * escaped, so nothing else in it can render as markup.
 * @param excerpt The excerpt.
 * @returns The excerpt with every other tag removed.
 */
export const sanitizeExcerpt = (excerpt: string): string =>
  excerpt.replaceAll(/<(?!\/?mark>)[^>]*>?/gu, '');

/**
 * Searches the site with Pagefind and reads the first results' data.
 * @param pagefind Pagefind's API.
 * @param query What the visitor typed.
 * @returns A promise that resolves to at most MAX_SEARCH_RESULTS results, with safe excerpts.
 */
export const searchSite = async (pagefind: IPagefind, query: string): Promise<ISearchResult[]> => {
  const search = await pagefind.search(query);
  const results = await Promise.all(
    (search?.results ?? []).slice(0, MAX_SEARCH_RESULTS).map((result) => result.data()),
  );
  return results.map(({ excerpt, meta, url }) => ({
    excerpt: sanitizeExcerpt(excerpt),
    title: meta.title ?? url,
    url,
  }));
};

/**
 * Shows results in a search dialog's list, and says how many there are in its status line, which
 * screen readers announce.
 * @param dialog The search dialog.
 * @param query What the visitor typed.
 * @param results The results.
 */
export const showResults = (
  dialog: HTMLElement,
  query: string,
  results: readonly ISearchResult[],
): void => {
  const document = dialog.ownerDocument;
  const list = dialog.querySelector('[data-search-results]');
  const status = dialog.querySelector('[data-search-status]');
  list?.replaceChildren(
    ...results.map(({ excerpt, title, url }) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = url;
      link.className =
        'block rounded-lg px-3 py-2.5 no-underline transition-colors hover:bg-secondary focus-visible:bg-secondary';
      const heading = document.createElement('span');
      heading.className = 'block text-sm font-semibold text-foreground';
      heading.textContent = title;
      const snippet = document.createElement('span');
      snippet.className =
        'mt-1 block text-xs leading-5 text-muted [&_mark]:bg-accent/15 [&_mark]:text-foreground';
      snippet.innerHTML = excerpt;
      link.append(heading, snippet);
      item.append(link);
      return item;
    }),
  );
  if (status !== null) {
    status.textContent =
      query === ''
        ? ''
        : results.length === 0
          ? `No results for “${query}”.`
          : `${String(results.length)} ${results.length === 1 ? 'result' : 'results'} for “${query}”.`;
  }
};

/**
 * Says in a search dialog's status line that search can't run, such as before the site's search
 * index is built.
 * @param dialog The search dialog.
 */
const showUnavailable = (dialog: HTMLElement): void => {
  dialog.querySelector('[data-search-results]')?.replaceChildren();
  const status = dialog.querySelector('[data-search-status]');
  if (status !== null) {
    status.textContent = "Search isn't available on this page.";
  }
};

/**
 * Closes a search dialog when Escape is pressed in its field, which would otherwise only clear the
 * field, as a search field does, and leave the dialog open.
 * @param event The key press.
 * @returns Whether it closed a dialog.
 */
const closeOnEscape = (event: KeyboardEvent): boolean => {
  const target = event.target as Partial<HTMLElement> | null;
  if (
    event.key !== 'Escape' ||
    event.defaultPrevented ||
    typeof target?.closest !== 'function' ||
    target.matches?.('[data-search-input]') !== true
  ) {
    return false;
  }
  const dialog = target.closest('dialog');
  if (dialog?.open !== true) {
    return false;
  }
  event.preventDefault();
  closeDialog(dialog);
  return true;
};

// one listener set and shared index-promise cache per document, including Astro swaps
const registeredDocuments = new WeakSet<Document>();

/** Updates loading state without blocking announcements in the adjacent status region. */
const setSearchPending = (container: HTMLElement, isPending: boolean): void => {
  container.querySelector('[data-search-results]')?.setAttribute('aria-busy', String(isPending));
  container.querySelector('[data-search-retry]')?.setAttribute('aria-disabled', String(isPending));
};

/** Hides a completed retry action while preserving useful keyboard focus. */
const hideSearchRetry = (container: HTMLElement): void => {
  const retry = container.querySelector<HTMLElement>('[data-search-retry]');
  if (retry === null) return;
  if (container.ownerDocument.activeElement === retry)
    container
      .querySelector<HTMLInputElement>('[data-search-input]')
      ?.focus({ preventScroll: true });
  retry.hidden = true;
};

/** Finds the search region only in a native dialog, ignoring other toggle/close events. */
const searchFromDialog = (target: EventTarget | null): HTMLElement | null => {
  const dialog = target as Partial<HTMLDialogElement> | null;
  return typeof dialog?.showModal === 'function'
    ? (dialog.querySelector?.<HTMLElement>('[data-search-dialog]') ?? null)
    : null;
};

/**
 * Registers document-owned search, native dialog lifecycle, and retry behavior. Queries retain
 * the existing debounce and eight-result bound. Request identities prevent stale completion,
 * including A/B/A queries. Failed imports are retried with a fresh module URL; healthy indexes
 * retain the existing shared promise per configured path. Closing/navigation cancels pending
 * timers and invalidates in-flight work without replacing Pagefind's own index cache.
 * @param root The owning document. Defaults to the page's.
 * @param load Optionally replaces only the Pagefind import boundary.
 */
export const registerSearchDialogs = (root: Document = document, load?: IPagefindLoader): void => {
  if (registeredDocuments.has(root)) return;
  registeredDocuments.add(root);
  const pagefinds = new Map<string, Promise<IPagefind>>();
  const failedLoads = new Map<string, number>();
  const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
  const generations = new WeakMap<HTMLElement, number>();
  const active = new Set<HTMLElement>();
  const loadIndex: IPagefindLoader =
    load ??
    ((path) => {
      const attempt = failedLoads.get(path) ?? 0;
      if (attempt === 0) return import(/* @vite-ignore */ path) as Promise<IPagefind>;
      const url = new URL(path, import.meta.url);
      url.searchParams.set('__jg_search_retry', String(attempt));
      return import(/* @vite-ignore */ url.href) as Promise<IPagefind>;
    });

  /** Cancels only this region's pending work; a shared index load may still serve other queries. */
  const cancel = (container: HTMLElement): void => {
    clearTimeout(timers.get(container));
    timers.delete(container);
    generations.set(container, (generations.get(container) ?? 0) + 1);
    active.delete(container);
    setSearchPending(container, false);
  };

  /** Schedules a query or runs an explicit retry, keeping every completion tied to its request. */
  const schedule = (container: HTMLElement, query: string, isRetry = false): void => {
    cancel(container);
    const generation = generations.get(container);
    if (query === '') {
      hideSearchRetry(container);
      showResults(container, '', []);
      return;
    }
    active.add(container);
    if (!isRetry) hideSearchRetry(container);
    setSearchPending(container, true);
    container.querySelector('[data-search-results]')?.replaceChildren();
    const status = container.querySelector('[data-search-status]');
    if (status !== null) status.textContent = 'Searching…';
    const isCurrent = (): boolean =>
      generations.get(container) === generation && container.isConnected;
    const run = async (): Promise<void> => {
      if (!isCurrent()) {
        active.delete(container);
        return;
      }
      const path = container.dataset['pagefindPath'] ?? '/pagefind/pagefind.js';
      let promise: Promise<IPagefind> | undefined;
      try {
        promise = pagefinds.get(path);
        if (promise === undefined) {
          promise = loadIndex(path);
          pagefinds.set(path, promise);
        }
        const results = await searchSite(await promise, query);
        if (isCurrent()) {
          setSearchPending(container, false);
          hideSearchRetry(container);
          showResults(container, query, results);
        }
      } catch {
        if (promise !== undefined && pagefinds.get(path) === promise) {
          pagefinds.delete(path);
          failedLoads.set(path, (failedLoads.get(path) ?? 0) + 1);
        }
        if (isCurrent()) {
          setSearchPending(container, false);
          showUnavailable(container);
          const retry = container.querySelector<HTMLElement>('[data-search-retry]');
          if (retry !== null) retry.hidden = false;
        }
      } finally {
        if (generations.get(container) === generation) {
          active.delete(container);
          timers.delete(container);
        }
      }
    };
    if (isRetry) void run();
    else
      timers.set(
        container,
        setTimeout(() => {
          void run();
        }, SEARCH_DELAY_MS),
      );
  };

  root.addEventListener('keydown', (event) => {
    if (closeOnEscape(event) || !isSearchShortcut(event)) return;
    const container =
      [...root.querySelectorAll<HTMLElement>('[data-search-dialog]')].find(
        (candidate) => candidate.closest('dialog')?.open === true,
      ) ?? root.querySelector('[data-search-dialog]');
    const dialog = container?.closest('dialog');
    if (dialog === null || dialog === undefined) return;
    event.preventDefault();
    if (!dialog.open)
      openDialog(dialog, root.activeElement === root.body ? null : root.activeElement);
    dialog.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
  });
  root.addEventListener('input', (event) => {
    const target = event.target as Partial<HTMLInputElement> | null;
    if (typeof target?.closest !== 'function' || target.matches?.('[data-search-input]') !== true)
      return;
    const container = target.closest<HTMLElement>('[data-search-dialog]');
    if (container !== null) schedule(container, (target.value ?? '').trim());
  });
  root.addEventListener('click', (event) => {
    const target = event.target as Partial<Element> | null;
    if (event.defaultPrevented || event.button !== 0 || typeof target?.closest !== 'function')
      return;
    const retry = target.closest<HTMLElement>('[data-search-retry]');
    const container = retry?.closest<HTMLElement>('[data-search-dialog]');
    if (
      retry === null ||
      retry === undefined ||
      container === null ||
      container === undefined ||
      retry.getAttribute('aria-disabled') === 'true'
    )
      return;
    const input = container.querySelector<HTMLInputElement>('[data-search-input]');
    if (input !== null) {
      event.preventDefault();
      schedule(container, input.value.trim(), true);
    }
  });
  root.addEventListener(
    'toggle',
    (event) => {
      const container = searchFromDialog(event.target);
      const dialog = event.target as HTMLDialogElement | null;
      if (container === null || dialog?.open !== true) return;
      const input = container.querySelector<HTMLInputElement>('[data-search-input]');
      if (input !== null) schedule(container, input.value.trim());
    },
    true,
  );
  root.addEventListener(
    'close',
    (event) => {
      const container = searchFromDialog(event.target);
      if (container !== null && (event.target as HTMLDialogElement).open === false)
        cancel(container);
    },
    true,
  );
  const clear = (): void => {
    for (const container of active) cancel(container);
  };
  root.addEventListener('astro:before-swap', clear);
  root.defaultView?.addEventListener('pagehide', clear);
};
