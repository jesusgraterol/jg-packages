import { afterEach, describe, expect, test, vi } from 'vitest';

import { registerTabs } from './tabs-behavior.ts';

// state decisions use a small DOM boundary; the co-located E2E suite exercises real markup
const createElement = (id: string, closest: (selector: string) => unknown) => {
  const attributes = new Map<string, string>();
  return {
    id,
    attributes,
    closest,
    dataset: {} as Record<string, string | undefined>,
    hidden: false,
    tabIndex: 0,
    scrollLeft: 0,
    clientLeft: 0,
    clientWidth: 128,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
    focus: vi.fn(),
    getBoundingClientRect: () => ({ left: 10, right: 138 }),
  };
};

/** Builds a readable, unenhanced group with realistic horizontal tab bounds. */
const createGroup = (prefix = 'example', ids = ['one', 'two'], key?: string) => {
  const matches = new Map<string, unknown[]>();
  const nested: { querySelectorAll: (selector: string) => unknown[] }[] = [];
  const element = {
    ...createElement(prefix, () => null),
    querySelectorAll: (selector: string): unknown[] => [
      ...(matches.get(selector) ?? []),
      ...nested.flatMap((element) => element.querySelectorAll(selector)),
    ],
  };
  if (key !== undefined) element.dataset['tabsStorageKey'] = key;
  const strip = createElement(`${prefix}-strip`, () => element);
  const list = createElement(`${prefix}-list`, () => element);
  const tabs = ids.map((id, index) => {
    const tab = createElement(`${prefix}-tab-${id}`, (selector): unknown =>
      selector === '[data-tabs]' ? element : selector === '[data-tab-id]' ? tab : null,
    );
    tab.dataset['tabId'] = id;
    tab.attributes.set('href', `#${prefix}-panel-${id}`);
    tab.getBoundingClientRect = () => ({
      left: 10 + index * 64 - strip.scrollLeft,
      right: 74 + index * 64 - strip.scrollLeft,
    });
    return tab;
  });
  const panels = ids.map((id) => {
    const panel = createElement(`${prefix}-panel-${id}`, () => element);
    panel.dataset['tabPanel'] = id;
    return panel;
  });
  const labels = ids.map((id) => createElement(`${prefix}-label-${id}`, () => element));
  matches.set('[data-tab-strip]', [strip]);
  matches.set('[data-tab-list]', [list]);
  matches.set('[data-tab-id]', tabs);
  matches.set('[data-tab-panel]', panels);
  matches.set('[data-tab-panel-label]', labels);
  return { element, strip, list, tabs, panels, labels, matches, nested };
};

/** Owns storage and delegated events independently for every test document. */
const createRoot = (groups: ReturnType<typeof createGroup>[]) => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => memory.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      memory.set(key, value);
    }),
  };
  const listeners = new Map<string, ((event: unknown) => void)[]>();
  const view = {
    get localStorage() {
      return storage;
    },
  };
  const root = {
    defaultView: view as typeof view | null,
    querySelectorAll: () => groups.map(({ element }) => element),
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };
  const dispatch = (type: string, target: unknown, extra: object = {}) => {
    const event = {
      target,
      key: '',
      button: 0,
      defaultPrevented: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
      ...extra,
    };
    listeners.get(type)?.forEach((listener) => listener(event));
    return event;
  };
  return {
    root,
    document: root as unknown as Document,
    groups,
    listeners,
    memory,
    storage,
    view,
    dispatch,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('registerTabs', () => {
  test('enhances a complete group and gives only the selected tab keyboard focus', () => {
    const group = createGroup();
    const fixture = createRoot([group]);
    vi.stubGlobal('document', fixture.document);
    registerTabs();
    expect(group.list.attributes.get('role')).toBe('tablist');
    expect(group.tabs.map(({ attributes }) => attributes.get('role'))).toStrictEqual([
      'tab',
      'tab',
    ]);
    expect(group.tabs.map(({ attributes }) => attributes.has('href'))).toStrictEqual([
      false,
      false,
    ]);
    expect(group.tabs.map(({ attributes }) => attributes.get('aria-selected'))).toStrictEqual([
      'true',
      'false',
    ]);
    expect(group.tabs.map(({ tabIndex }) => tabIndex)).toStrictEqual([0, -1]);
    expect(group.panels.map(({ hidden }) => hidden)).toStrictEqual([false, true]);
    expect(group.labels.map(({ hidden }) => hidden)).toStrictEqual([true, true]);
    expect(group.tabs[0]?.attributes.get('aria-controls')).toBe('example-panel-one');
    expect(group.panels[1]?.attributes.get('aria-labelledby')).toBe('example-tab-two');
    expect(fixture.storage.getItem).not.toHaveBeenCalled();
    const click = fixture.dispatch('click', group.tabs[1]);
    expect(click.preventDefault).toHaveBeenCalledOnce();
    expect(group.panels.map(({ hidden }) => hidden)).toStrictEqual([true, false]);
    expect(fixture.storage.setItem).not.toHaveBeenCalled();
  });

  test('restores valid choices and reveals the selected tab horizontally', () => {
    const group = createGroup('remembered', ['one', 'two', 'three'], 'choice');
    const fixture = createRoot([group]);
    fixture.memory.set('choice', 'three');
    registerTabs(fixture.document);
    expect(group.panels.map(({ hidden }) => hidden)).toStrictEqual([true, true, false]);
    expect(group.strip.scrollLeft).toBe(64);
    fixture.dispatch('keydown', group.tabs[2], { key: 'Home' });
    expect(group.strip.scrollLeft).toBe(0);
    expect(group.tabs[0]?.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });

  test.each(['unknown', 'unavailable', 'missing-window'] as const)(
    'keeps a valid selection when storage is %s',
    (kind) => {
      const group = createGroup('stored', ['one', 'two'], 'choice');
      const fixture = createRoot([group]);
      if (kind === 'unknown') fixture.memory.set('choice', 'gone');
      if (kind === 'unavailable')
        vi.spyOn(fixture.view, 'localStorage', 'get').mockImplementation(() => {
          throw new Error('blocked');
        });
      if (kind === 'missing-window') fixture.root.defaultView = null;
      registerTabs(fixture.document);
      expect(group.panels.map(({ hidden }) => hidden)).toStrictEqual([false, true]);
      fixture.dispatch('click', group.tabs[1]);
      expect(group.panels.map(({ hidden }) => hidden)).toStrictEqual([true, false]);
    },
  );

  test('synchronizes exact keys, tolerates incompatible groups, and keeps nested groups independent', () => {
    const key = 'choice"[special]';
    const outer = createGroup('outer', ['one', 'two'], key);
    const peer = createGroup('peer', ['one', 'two'], key);
    const incompatible = createGroup('other', ['one', 'three'], key);
    const unrelated = createGroup('unrelated', ['one', 'two'], 'another-key');
    const inner = createGroup('inner');
    const invalid = createGroup('invalid');
    invalid.matches.delete('[data-tab-list]');
    outer.nested.push(inner.element);
    const fixture = createRoot([outer, peer, incompatible, unrelated, inner, invalid]);
    registerTabs(fixture.document);
    fixture.dispatch('click', inner.tabs[1]);
    expect(inner.panels.map(({ hidden }) => hidden)).toStrictEqual([true, false]);
    expect(outer.panels.map(({ hidden }) => hidden)).toStrictEqual([false, true]);
    fixture.dispatch('click', outer.tabs[1]);
    expect(peer.panels.map(({ hidden }) => hidden)).toStrictEqual([true, false]);
    expect(incompatible.panels.map(({ hidden }) => hidden)).toStrictEqual([false, true]);
    expect(unrelated.panels.map(({ hidden }) => hidden)).toStrictEqual([false, true]);
    expect(fixture.memory.get(key)).toBe('two');
  });

  test.each([
    ['ArrowRight', 0, 1],
    ['ArrowLeft', 0, 1],
    ['ArrowRight', 1, 0],
    ['Home', 1, 0],
    ['End', 0, 1],
    ['Enter', 0, 0],
    [' ', 0, 0],
  ])('keyboard %s at %d chooses %d', (key, start, destination) => {
    const group = createGroup();
    const fixture = createRoot([group]);
    registerTabs(fixture.document);
    const event = fixture.dispatch('keydown', group.tabs[start], { key });
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(group.tabs[destination]?.attributes.get('aria-selected')).toBe('true');
    expect(group.tabs[destination]?.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });

  test('initializes new Astro groups without registering duplicate document listeners', () => {
    const first = createGroup('first');
    const fixture = createRoot([first]);
    registerTabs(fixture.document);
    registerTabs(fixture.document);
    const second = createGroup('second');
    fixture.groups.push(second);
    fixture.dispatch('astro:page-load', null);
    expect(second.list.attributes.get('role')).toBe('tablist');
    const third = createGroup('third');
    fixture.groups.push(third);
    registerTabs(fixture.document);
    expect(third.list.attributes.get('role')).toBe('tablist');
    expect([...fixture.listeners.values()].map((listeners) => listeners.length)).toStrictEqual([
      1, 1, 1,
    ]);
  });

  test.each([
    [
      'missing strip',
      (group: ReturnType<typeof createGroup>) => group.matches.delete('[data-tab-strip]'),
    ],
    [
      'missing list',
      (group: ReturnType<typeof createGroup>) => group.matches.delete('[data-tab-list]'),
    ],
    ['missing panel', (group: ReturnType<typeof createGroup>) => group.panels.pop()],
    [
      'duplicate panels',
      (group: ReturnType<typeof createGroup>) => {
        if (group.panels[1]) group.panels[1].dataset['tabPanel'] = 'one';
      },
    ],
    [
      'missing tab id',
      (group: ReturnType<typeof createGroup>) => {
        if (group.tabs[0]) delete group.tabs[0].dataset['tabId'];
      },
    ],
    [
      'empty tab id',
      (group: ReturnType<typeof createGroup>) => {
        if (group.tabs[0]) group.tabs[0].dataset['tabId'] = '';
      },
    ],
    [
      'duplicate tabs',
      (group: ReturnType<typeof createGroup>) => {
        if (group.tabs[1]) group.tabs[1].dataset['tabId'] = 'one';
      },
    ],
    [
      'unmatched panel',
      (group: ReturnType<typeof createGroup>) => {
        if (group.panels[1]) group.panels[1].dataset['tabPanel'] = 'other';
      },
    ],
    [
      'missing link identifier',
      (group: ReturnType<typeof createGroup>) => {
        if (group.tabs[0]) group.tabs[0].id = '';
      },
    ],
    [
      'missing panel identifier',
      (group: ReturnType<typeof createGroup>) => {
        if (group.panels[0]) group.panels[0].id = '';
      },
    ],
  ])('leaves all content readable for %s', (_description, invalidate) => {
    const group = createGroup();
    invalidate(group);
    const fixture = createRoot([group]);
    registerTabs(fixture.document);
    expect(group.panels.every(({ hidden }) => !hidden)).toBe(true);
    expect(group.tabs.every(({ attributes }) => !attributes.has('role'))).toBe(true);
    expect(fixture.dispatch('click', group.tabs[0]).preventDefault).not.toHaveBeenCalled();
  });

  test('leaves an empty group unenhanced', () => {
    const group = createGroup('empty', []);
    const fixture = createRoot([group]);
    registerTabs(fixture.document);
    expect(group.list.attributes.get('role')).toBeUndefined();
  });

  test.each([null, {}, { closest: () => null }])(
    'ignores an unrelated event target %o',
    (target) => {
      const fixture = createRoot([createGroup()]);
      registerTabs(fixture.document);
      expect(fixture.dispatch('click', target).preventDefault).not.toHaveBeenCalled();
      expect(
        fixture.dispatch('keydown', target, { key: 'ArrowRight' }).preventDefault,
      ).not.toHaveBeenCalled();
    },
  );

  test('ignores orphan links and elements outside a registered group', () => {
    const group = createGroup();
    const fixture = createRoot([group]);
    registerTabs(fixture.document);
    const orphan = createElement('orphan', (selector): unknown =>
      selector === '[data-tab-id]' ? orphan : null,
    );
    const extra = createElement('extra', (selector): unknown =>
      selector === '[data-tab-id]' ? extra : group.element,
    );
    for (const target of [orphan, extra])
      expect(fixture.dispatch('click', target).preventDefault).not.toHaveBeenCalled();
  });

  test.each([{ defaultPrevented: true }, { button: 1 }])(
    'leaves inhibited clicks alone: %o',
    (extra) => {
      const group = createGroup();
      const fixture = createRoot([group]);
      registerTabs(fixture.document);
      expect(fixture.dispatch('click', group.tabs[1], extra).preventDefault).not.toHaveBeenCalled();
      expect(group.panels.map(({ hidden }) => hidden)).toStrictEqual([false, true]);
    },
  );

  test.each([
    { defaultPrevented: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { key: 'Tab' },
  ])('leaves unrelated or modified keys alone: %o', (extra) => {
    const group = createGroup();
    const fixture = createRoot([group]);
    registerTabs(fixture.document);
    expect(
      fixture.dispatch('keydown', group.tabs[1], { key: 'ArrowRight', ...extra }).preventDefault,
    ).not.toHaveBeenCalled();
  });
});
