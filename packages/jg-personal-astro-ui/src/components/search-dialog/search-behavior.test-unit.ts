import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  isSearchShortcut,
  MAX_SEARCH_RESULTS,
  registerSearchDialogs,
  sanitizeExcerpt,
  SEARCH_DELAY_MS,
  searchSite,
  showResults,
  type IPagefind,
  type IPagefindResultData,
} from './search-behavior.ts';

/*
 * The search dialog's behavior against fake elements and a fake Pagefind. The browser test runs it
 * on real markup in Chromium, Firefox, and WebKit.
 */

/**
 * Builds a fake key press.
 * @param key The key.
 * @param options Its modifiers, its target, whether a script handled it, and its preventDefault.
 * @returns The key press.
 */
const createKeyPress = (
  key: string,
  options: {
    altKey?: boolean;
    ctrlKey?: boolean;
    defaultPrevented?: boolean;
    metaKey?: boolean;
    preventDefault?: () => void;
    target?: unknown;
  } = {},
): KeyboardEvent =>
  ({
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    key,
    metaKey: false,
    preventDefault: vi.fn(),
    target: null,
    ...options,
  }) as unknown as KeyboardEvent;

/**
 * Builds a fake Pagefind whose results are the given pages.
 * @param pages The pages, or null for a search Pagefind dropped.
 * @returns Pagefind's API, with a spy on search.
 */
const createPagefind = (pages: IPagefindResultData[] | null) => ({
  search: vi.fn((query: string) => {
    void query;
    return Promise.resolve(
      pages === null
        ? null
        : { results: pages.map((page) => ({ data: () => Promise.resolve(page) })) },
    );
  }),
});

// a fake element of the dialog's markup
type IFakeElement = {
  append: (...children: IFakeElement[]) => void;
  children: IFakeElement[];
  className: string;
  href: string;
  innerHTML: string;
  replaceChildren: (...children: IFakeElement[]) => void;
  tagName: string;
  textContent: string;
};

/**
 * Builds a fake element.
 * @param tagName Its tag.
 * @returns The element.
 */
const createElement = (tagName: string): IFakeElement => {
  const element: IFakeElement = {
    append: (...children) => element.children.push(...children),
    children: [],
    className: '',
    href: '',
    innerHTML: '',
    replaceChildren: (...children) => {
      element.children = children;
    },
    tagName: tagName.toUpperCase(),
    textContent: '',
  };
  return element;
};

/**
 * Builds a fake search dialog: its container, its list, its status, its input, and its dialog.
 * @param options The Pagefind path, and whether the dialog starts open.
 * @returns The parts.
 */
const createSearchDialog = ({
  pagefindPath,
  open = false,
}: { pagefindPath?: string; open?: boolean } = {}) => {
  const list = createElement('ul');
  const status = createElement('p');
  const input = {
    focus: vi.fn(),
    matches: (selector: string) => selector === '[data-search-input]',
    value: '',
    closest: (selector: string) => (selector === '[data-search-dialog]' ? container : null),
  };
  const dialog = {
    open,
    showModal: vi.fn(() => {
      dialog.open = true;
    }),
    querySelector: (selector: string) => (selector === '[data-search-input]' ? input : null),
  };
  const container = {
    closest: (selector: string) => (selector === 'dialog' ? dialog : null),
    dataset: pagefindPath === undefined ? {} : { pagefindPath },
    ownerDocument: { createElement },
    querySelector: (selector: string) =>
      ({ '[data-search-results]': list, '[data-search-status]': status })[selector] ?? null,
  };
  return { container, dialog, input, list, status };
};

/**
 * Builds a fake document holding a search dialog, recording its listeners.
 * @param parts The search dialog's parts, or null for a page without one.
 * @returns The document, and a way to fire its events.
 */
const createDocument = (parts: ReturnType<typeof createSearchDialog> | null) => {
  const attributes = new Set<string>();
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  const activeElement = { focus: vi.fn() };
  const root = {
    activeElement,
    documentElement: {
      hasAttribute: (name: string) => attributes.has(name),
      setAttribute: (name: string) => attributes.add(name),
    },
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    querySelector: (selector: string) =>
      selector === '[data-search-dialog]' ? (parts?.container ?? null) : null,
  };
  const fire = (type: string, event: unknown) => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };
  return { root: root as unknown as Document, listeners, fire, activeElement };
};

// one page of results, as Pagefind returns it
const page = (title: string | undefined, url: string): IPagefindResultData => ({
  excerpt: `about <mark>${title ?? url}</mark>`,
  meta: { title },
  url,
});

describe('isSearchShortcut', () => {
  test('opens search on Ctrl+K and Cmd+K anywhere, and on / outside a text field', () => {
    expect(isSearchShortcut(createKeyPress('k', { ctrlKey: true }))).toBe(true);
    expect(isSearchShortcut(createKeyPress('K', { metaKey: true }))).toBe(true);
    expect(isSearchShortcut(createKeyPress('/'))).toBe(true);
    expect(isSearchShortcut(createKeyPress('/', { target: { tagName: 'BUTTON' } }))).toBe(true);
  });

  test('leaves / to text fields, and ignores other keys and handled ones', () => {
    expect(isSearchShortcut(createKeyPress('/', { target: { tagName: 'INPUT' } }))).toBe(false);
    expect(isSearchShortcut(createKeyPress('/', { target: { tagName: 'TEXTAREA' } }))).toBe(false);
    expect(isSearchShortcut(createKeyPress('/', { target: { isContentEditable: true } }))).toBe(
      false,
    );
    expect(isSearchShortcut(createKeyPress('j', { ctrlKey: true }))).toBe(false);
    expect(isSearchShortcut(createKeyPress('/', { ctrlKey: true }))).toBe(false);
    expect(isSearchShortcut(createKeyPress('k'))).toBe(false);
    expect(isSearchShortcut(createKeyPress('/', { altKey: true }))).toBe(false);
    expect(isSearchShortcut(createKeyPress('/', { defaultPrevented: true }))).toBe(false);
  });
});

describe('sanitizeExcerpt', () => {
  test('keeps the <mark> tags and removes every other tag', () => {
    expect(
      sanitizeExcerpt('a <mark>match</mark> &amp; <img src=x onerror=alert(1)>b<script>c'),
    ).toBe('a <mark>match</mark> &amp; bc');
    expect(sanitizeExcerpt('<mark class="x">no</mark>')).toBe('no</mark>');
  });
});

describe('searchSite', () => {
  test('reads the first results, with safe excerpts, and the URL as a missing title', async () => {
    const pagefind = createPagefind([
      page('jg-fetch', '/packages/jg-fetch/'),
      page(undefined, '/x/'),
    ]);

    expect(await searchSite(pagefind, 'fetch')).toStrictEqual([
      { excerpt: 'about <mark>jg-fetch</mark>', title: 'jg-fetch', url: '/packages/jg-fetch/' },
      { excerpt: 'about <mark>/x/</mark>', title: '/x/', url: '/x/' },
    ]);
    expect(pagefind.search).toHaveBeenCalledWith('fetch');
  });

  test(`lists at most ${String(MAX_SEARCH_RESULTS)} results, and none for a dropped search`, async () => {
    const pages = Array.from({ length: 12 }, (_, index) =>
      page(`p${String(index)}`, `/${String(index)}/`),
    );

    expect(await searchSite(createPagefind(pages), 'p')).toHaveLength(MAX_SEARCH_RESULTS);
    expect(await searchSite(createPagefind(null), 'p')).toStrictEqual([]);
  });
});

describe('showResults', () => {
  test('lists each result as a link with its title and excerpt, and counts them', () => {
    const { container, list, status } = createSearchDialog();

    showResults(container as unknown as HTMLElement, 'fetch', [
      { excerpt: '<mark>fetch</mark>', title: 'jg-fetch', url: '/packages/jg-fetch/' },
    ]);

    const link = list.children[0]?.children[0];
    expect(link?.href).toBe('/packages/jg-fetch/');
    expect(link?.children[0]?.textContent).toBe('jg-fetch');
    expect(link?.children[1]?.innerHTML).toBe('<mark>fetch</mark>');
    expect(status.textContent).toBe('1 result for “fetch”.');
  });

  test('says when nothing matched, counts in the plural, and clears for an empty query', () => {
    const { container, status } = createSearchDialog();
    const results = [
      { excerpt: '', title: 'a', url: '/a/' },
      { excerpt: '', title: 'b', url: '/b/' },
    ];

    showResults(container as unknown as HTMLElement, 'zzz', []);
    expect(status.textContent).toBe('No results for “zzz”.');
    showResults(container as unknown as HTMLElement, 'a', results);
    expect(status.textContent).toBe('2 results for “a”.');
    showResults(container as unknown as HTMLElement, '', []);
    expect(status.textContent).toBe('');
  });

  test('copes with a dialog without its list or status', () => {
    const dialog = { ownerDocument: { createElement }, querySelector: () => null };

    expect(() => showResults(dialog as unknown as HTMLElement, 'a', [])).not.toThrow();
  });
});

describe('registerSearchDialogs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Types a query into the dialog's field.
   * @param fire The document's event dispatcher.
   * @param parts The dialog's parts.
   * @param value What to type.
   */
  const type = (
    fire: (type: string, event: unknown) => void,
    parts: ReturnType<typeof createSearchDialog>,
    value: string,
  ) => {
    parts.input.value = value;
    fire('input', { target: parts.input });
  };

  test('opens the dialog on the shortcut, remembering the focused element, with its field focused', () => {
    const parts = createSearchDialog();
    const { root, fire } = createDocument(parts);
    registerSearchDialogs(root, vi.fn());
    const preventDefault = vi.fn();

    fire('keydown', createKeyPress('k', { ctrlKey: true, preventDefault }));

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(parts.dialog.showModal).toHaveBeenCalledOnce();
    expect(parts.input.focus).toHaveBeenCalledOnce();
  });

  test('ignores the shortcut while the dialog is open, other keys, and pages without search', () => {
    const open = createSearchDialog({ open: true });
    const openDocument = createDocument(open);
    registerSearchDialogs(openDocument.root, vi.fn());
    const other = createSearchDialog();
    const otherDocument = createDocument(other);
    registerSearchDialogs(otherDocument.root, vi.fn());
    const empty = createDocument(null);
    registerSearchDialogs(empty.root, vi.fn());
    const orphan = createSearchDialog();
    orphan.container.closest = () => null;
    const orphanDocument = createDocument(orphan);
    registerSearchDialogs(orphanDocument.root, vi.fn());

    openDocument.fire('keydown', createKeyPress('/'));
    otherDocument.fire('keydown', createKeyPress('a'));
    empty.fire('keydown', createKeyPress('/'));
    orphanDocument.fire('keydown', createKeyPress('/'));

    expect(open.dialog.showModal).not.toHaveBeenCalled();
    expect(other.dialog.showModal).not.toHaveBeenCalled();
    expect(orphan.dialog.showModal).not.toHaveBeenCalled();
  });

  test('searches once the visitor pauses, loading Pagefind from its path once', async () => {
    const parts = createSearchDialog({ pagefindPath: '/docs/pagefind/pagefind.js' });
    const { root, fire } = createDocument(parts);
    const pagefind = createPagefind([page('jg-fetch', '/packages/jg-fetch/')]);
    const load = vi.fn(() => Promise.resolve(pagefind as IPagefind));
    registerSearchDialogs(root, load);

    type(fire, parts, 'fe');
    type(fire, parts, 'fetch');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS - 1);
    expect(pagefind.search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    type(fire, parts, 'fetch ');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);

    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith('/docs/pagefind/pagefind.js');
    expect(pagefind.search).toHaveBeenCalledWith('fetch');
    expect(parts.status.textContent).toBe('1 result for “fetch”.');
  });

  test("keeps a newer search's results when an older one answers last", async () => {
    const parts = createSearchDialog();
    const { root, fire } = createDocument(parts);
    let answerSlow: (value: unknown) => void = () => undefined;
    const pagefind = {
      search: vi.fn((query: string) =>
        query === 'slow'
          ? new Promise((resolve) => {
              answerSlow = resolve;
            })
          : Promise.resolve({ results: [{ data: () => Promise.resolve(page('fast', '/fast/')) }] }),
      ),
    };
    registerSearchDialogs(root, () => Promise.resolve(pagefind as unknown as IPagefind));

    type(fire, parts, 'slow');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);
    type(fire, parts, 'fast');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);
    answerSlow({ results: [] });
    await vi.advanceTimersByTimeAsync(0);

    expect(parts.status.textContent).toBe('1 result for “fast”.');
  });

  test('clears the results when the field is emptied', () => {
    const parts = createSearchDialog();
    const { root, fire } = createDocument(parts);
    registerSearchDialogs(root, vi.fn());
    parts.status.textContent = '1 result for “fetch”.';

    type(fire, parts, '  ');

    expect(parts.status.textContent).toBe('');
  });

  test("says search isn't available when Pagefind can't load, and tries again next time", async () => {
    const parts = createSearchDialog();
    const { root, fire } = createDocument(parts);
    const load = vi.fn(() => Promise.reject(new Error('404')));
    registerSearchDialogs(root, load);

    type(fire, parts, 'fetch');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);
    expect(parts.status.textContent).toBe("Search isn't available on this page.");
    type(fire, parts, 'fetchy');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);

    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledWith('/pagefind/pagefind.js');
  });

  test('stays quiet when a failed search is no longer the latest', async () => {
    const parts = createSearchDialog();
    const { root, fire } = createDocument(parts);
    let fail: (reason: unknown) => void = () => undefined;
    registerSearchDialogs(
      root,
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );

    type(fire, parts, 'fetch');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);
    type(fire, parts, '');
    fail(new Error('404'));
    await vi.advanceTimersByTimeAsync(0);

    expect(parts.status.textContent).toBe('');
  });

  test('ignores input outside a search field, and copes with a dialog without its parts', () => {
    const parts = createSearchDialog();
    const { root, fire } = createDocument(parts);
    registerSearchDialogs(root, vi.fn());

    expect(() => {
      fire('input', { target: null });
      fire('input', { target: { closest: () => null, matches: () => false } });
      fire('input', { target: { closest: () => null, matches: () => true, value: 'x' } });
    }).not.toThrow();
  });

  test('copes with a failed search in a dialog without its list or status', async () => {
    const parts = createSearchDialog();
    parts.container.querySelector = () => null;
    const { root, fire } = createDocument(parts);
    registerSearchDialogs(root, () => Promise.reject(new Error('404')));

    type(fire, parts, 'fetch');

    await expect(vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS)).resolves.not.toThrow();
  });

  test('adds one listener of each kind, however many times it runs', () => {
    const { root, listeners } = createDocument(createSearchDialog());

    registerSearchDialogs(root, vi.fn());
    registerSearchDialogs(root, vi.fn());

    expect(listeners.get('keydown')).toHaveLength(1);
    expect(listeners.get('input')).toHaveLength(1);
  });

  test("registers on the page's document by default, loading Pagefind with a dynamic import", async () => {
    const parts = createSearchDialog({ pagefindPath: '/missing/pagefind.js' });
    const { root, fire } = createDocument(parts);
    vi.stubGlobal('document', root);

    registerSearchDialogs();
    type(fire, parts, 'fetch');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);
    await vi.waitFor(() => {
      expect(parts.status.textContent).toBe("Search isn't available on this page.");
    });
  });
});
