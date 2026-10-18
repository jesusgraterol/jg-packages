import { openDialog } from '../dialog/dialog-behavior.ts';

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
 * Makes the page's search dialogs work: the shortcut opens one, with its field focused, and
 * typing searches with Pagefind once the visitor pauses. A newer search replaces an older one's
 * results, even when the older one answers last. One key listener and one input listener on the
 * document serve them all; the attribute set on the root element keeps a second call from adding
 * second listeners.
 * @param root The document. Defaults to the page's.
 * @param load Loads Pagefind from the dialog's `data-pagefind-path`. Defaults to a dynamic import.
 */
export const registerSearchDialogs = (
  root: Document = document,
  load: IPagefindLoader = (path) => import(/* @vite-ignore */ path) as Promise<IPagefind>,
): void => {
  if (root.documentElement.hasAttribute('data-search-dialogs-ready')) {
    return;
  }
  root.documentElement.setAttribute('data-search-dialogs-ready', '');
  const pagefinds = new Map<string, Promise<IPagefind>>();
  const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
  const latestQueries = new WeakMap<HTMLElement, string>();

  root.addEventListener('keydown', (event) => {
    // the dialog element that holds the page's search
    const dialog = root.querySelector('[data-search-dialog]')?.closest('dialog');
    if (dialog === null || dialog === undefined || dialog.open || !isSearchShortcut(event)) {
      return;
    }
    event.preventDefault();
    openDialog(dialog, root.activeElement);
    dialog.querySelector<HTMLInputElement>('[data-search-input]')?.focus();
  });

  root.addEventListener('input', (event) => {
    const target = event.target as Partial<HTMLInputElement> | null;
    if (typeof target?.closest !== 'function' || target.matches?.('[data-search-input]') !== true) {
      return;
    }
    // the search field, now that it matched
    const input = target as HTMLInputElement;
    const dialog = input.closest<HTMLElement>('[data-search-dialog]');
    if (dialog === null) {
      return;
    }
    const query = input.value.trim();
    latestQueries.set(dialog, query);
    clearTimeout(timers.get(dialog));
    if (query === '') {
      showResults(dialog, '', []);
      return;
    }
    timers.set(
      dialog,
      setTimeout(() => {
        const path = dialog.dataset['pagefindPath'] ?? '/pagefind/pagefind.js';
        if (!pagefinds.has(path)) {
          pagefinds.set(path, load(path));
        }
        void (async () => {
          try {
            const results = await searchSite(
              await (pagefinds.get(path) as Promise<IPagefind>),
              query,
            );
            if (latestQueries.get(dialog) === query) {
              showResults(dialog, query, results);
            }
          } catch {
            pagefinds.delete(path);
            if (latestQueries.get(dialog) === query) {
              showUnavailable(dialog);
            }
          }
        })();
      }, SEARCH_DELAY_MS),
    );
  });
};
