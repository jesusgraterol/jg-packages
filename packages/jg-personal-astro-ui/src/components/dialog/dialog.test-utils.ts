import { runInNewContext } from 'node:vm';
import { vi } from 'vitest';

import { buildDialogHistoryBootstrap } from './dialog-history.ts';

interface IFakeElement {
  id: string;
  attributes: Map<string, string>;
  queries: Map<string, IFakeElement>;
  ancestors: Map<string, unknown>;
  dataset: Record<string, string | undefined>;
  style: ReturnType<typeof createStyle>;
  isConnected: boolean;
  parentElement: IFakeElement | null;
  clientWidth: number;
  scrollTop: number;
  hasAttribute: (name: string) => boolean;
  setAttribute: (name: string, value: string) => unknown;
  removeAttribute: (name: string) => unknown;
  getClientRects: ReturnType<typeof vi.fn<() => object[]>>;
  querySelector: (selector: string) => IFakeElement | null;
  closest: (selector: string) => unknown;
  contains: (candidate: unknown) => boolean;
  focus: ReturnType<typeof vi.fn<(options?: object) => void>>;
  ownerDocument: unknown;
}

/** Models owned inline properties without hiding mutations in unrelated properties. */
const createStyle = () => {
  const properties = new Map<string, { value: string; priority: string }>();
  return {
    get length() {
      return properties.size;
    },
    getPropertyValue: (name: string) => properties.get(name)?.value ?? '',
    getPropertyPriority: (name: string) => properties.get(name)?.priority ?? '',
    setProperty: (name: string, value: string, priority = '') => {
      properties.set(name, { value, priority });
    },
    removeProperty: (name: string) => {
      const previous = properties.get(name)?.value ?? '';
      properties.delete(name);
      return previous;
    },
  };
};

/** Supplies a small DOM boundary; browser and rendered tests retain real native dialogs. */
export const createDialogFixture = () => {
  type IListener = (event: {
    target?: unknown;
    detail?: unknown;
    stopImmediatePropagation: () => void;
  }) => void;
  const rootListeners = new Map<string, IListener[]>();
  const viewListeners = new Map<string, IListener[]>();
  const byId = new Map<string, unknown>();
  const documentQueries = new Map<string, ReturnType<typeof createElement>>();
  const addListener = (listeners: Map<string, IListener[]>, name: string, listener: IListener) => {
    listeners.set(name, [...(listeners.get(name) ?? []), listener]);
  };
  const emit = (listeners: Map<string, IListener[]>, name: string, target?: unknown) => {
    const event = { target, stopImmediatePropagation: vi.fn() };
    listeners.get(name)?.forEach((listener) => listener(event));
    return event;
  };
  const createElement = (id = ''): IFakeElement => {
    const attributes = new Map<string, string>();
    const queries = new Map<string, ReturnType<typeof createElement>>();
    const ancestors = new Map<string, unknown>();
    const element = {
      id,
      attributes,
      queries,
      ancestors,
      dataset: {} as Record<string, string | undefined>,
      style: createStyle(),
      isConnected: true,
      parentElement: null as ReturnType<typeof createElement> | null,
      clientWidth: 1024,
      scrollTop: 0,
      hasAttribute: (name: string) => attributes.has(name),
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
      getClientRects: vi.fn(() => [{}]),
      querySelector: (selector: string): ReturnType<typeof createElement> | null =>
        queries.get(selector) ?? null,
      closest: (selector: string): unknown => ancestors.get(selector) ?? null,
      contains: (candidate: unknown) =>
        [...queries.values()].some((element) => element === candidate),
      focus: vi.fn((options?: object) => {
        void options;
        root.activeElement = element;
      }),
      ownerDocument: undefined as unknown,
    };
    return element;
  };
  const body = createElement('body');
  const html = createElement('html');
  const main = createElement('main');
  let token = 0;
  let index = 0;
  let destination: number | undefined;
  const historyEntries: unknown[] = [null];
  const view = {
    document: undefined as unknown as Document,
    scrollX: 8,
    scrollY: 256,
    innerWidth: 1040,
    isPhone: true,
    location: { href: 'https://example.com/reference/' },
    crypto: {
      getRandomValues: (array: Uint32Array) => {
        array[0] = ++token;
        return array;
      },
    },
    matchMedia: vi.fn(() => ({ matches: view.isPhone })),
    getComputedStyle: vi.fn(() => ({ paddingRight: '12px' })),
    scrollTo: vi.fn(({ left, top }: { left: number; top: number }) => {
      view.scrollX = left;
      view.scrollY = top;
    }),
    addEventListener: (name: string, listener: IListener) =>
      addListener(viewListeners, name, listener),
    history: {
      get state(): unknown {
        return historyEntries[index];
      },
      pushState: vi.fn((state: unknown, _title: string, url?: string) => {
        historyEntries.splice(index + 1);
        historyEntries.push(state);
        index++;
        if (url !== undefined) view.location.href = url;
      }),
      replaceState: vi.fn((state: unknown) => {
        historyEntries[index] = state;
      }),
      back: vi.fn(() => {
        destination = Math.max(0, index - 1);
      }),
    },
  };
  const root = {
    defaultView: view as typeof view | null,
    body,
    documentElement: html,
    activeElement: undefined as ReturnType<typeof createElement> | undefined,
    addEventListener: vi.fn((name: string, listener: IListener, options?: unknown) => {
      void options;
      addListener(rootListeners, name, listener);
    }),
    dispatchEvent: (event: CustomEvent) => {
      rootListeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
    getElementById: (id: string) => byId.get(id) ?? null,
    querySelector: (selector: string) => documentQueries.get(selector) ?? null,
  };
  view.document = root as unknown as Document;
  const bootstrap = () => {
    runInNewContext(buildDialogHistoryBootstrap(), { window: view, document: root, CustomEvent });
  };
  bootstrap();
  for (const element of [html, body, main]) element.ownerDocument = root;
  documentQueries.set('main', main);
  const element = (id = '') => {
    const result = createElement(id);
    result.ownerDocument = root;
    return result;
  };
  const dialog = (id = 'example') => {
    const base = element(id);
    const result = {
      ...base,
      open: false,
      showModal: vi.fn(() => {
        result.open = true;
      }),
      close: vi.fn(() => {
        result.open = false;
      }),
    };
    result.ancestors.set('dialog[data-dialog]', result);
    result.ancestors.set('dialog', result);
    byId.set(id, result);
    return result;
  };
  const trigger = (target: ReturnType<typeof dialog>) => {
    const control = element('trigger');
    control.dataset['dialogOpen'] = target.id;
    control.ancestors.set('[data-dialog-open]', control);
    return control;
  };
  const flushHistory = () => {
    if (destination !== undefined) {
      index = destination;
      destination = undefined;
      emit(viewListeners, 'popstate');
    }
  };
  return {
    root,
    document: root as unknown as Document,
    view,
    window: view as unknown as Window,
    body,
    html,
    main,
    element,
    dialog,
    trigger,
    documentQueries,
    rootListeners,
    viewListeners,
    bootstrap,
    emitRoot: (name: string) => emit(rootListeners, name),
    emitView: (name: string) => emit(viewListeners, name),
    historyEntries,
    flushHistory,
    traverse: (delta: number) => {
      destination = Math.min(historyEntries.length - 1, Math.max(0, index + delta));
      flushHistory();
    },
  };
};
