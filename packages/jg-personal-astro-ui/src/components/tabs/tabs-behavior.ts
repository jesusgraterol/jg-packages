// one validated relationship between a panel and its activating link
interface ITabItem {
  id: string;
  tab: HTMLAnchorElement;
  panel: HTMLElement;
}

// DOM references owned by one group; nested groups retain their own state
interface ITabGroup {
  element: HTMLElement;
  strip: HTMLElement;
  list: HTMLElement;
  items: ITabItem[];
  firstId: string;
}

// document identity survives Astro navigation even when root attributes are replaced
const initializers = new WeakMap<Document, () => void>();

/** Returns only a group's own matches, leaving nested groups to their owner. */
const ownElements = <T extends HTMLElement>(group: HTMLElement, selector: string): T[] =>
  [...group.querySelectorAll<T>(selector)].filter(
    (element) => element.closest('[data-tabs]') === group,
  );

/** Reads a complete group before enhancement can hide any server-rendered content. */
const readGroup = (element: HTMLElement): ITabGroup | undefined => {
  const strip = ownElements<HTMLElement>(element, '[data-tab-strip]')[0];
  const list = ownElements<HTMLElement>(element, '[data-tab-list]')[0];
  const tabs = ownElements<HTMLAnchorElement>(element, '[data-tab-id]');
  const panels = ownElements<HTMLElement>(element, '[data-tab-panel]');
  const byId = new Map(panels.map((panel) => [panel.dataset['tabPanel'], panel]));
  if (
    strip === undefined ||
    list === undefined ||
    panels.length !== tabs.length ||
    byId.size !== panels.length
  )
    return undefined;
  const items: ITabItem[] = [];
  const seen = new Set<string>();
  for (const tab of tabs) {
    const id = tab.dataset['tabId'];
    const panel = byId.get(id);
    if (
      id === undefined ||
      id === '' ||
      seen.has(id) ||
      panel === undefined ||
      tab.id === '' ||
      panel.id === ''
    )
      return undefined;
    items.push({ id, tab, panel });
    seen.add(id);
  }
  const first = items[0];
  return first === undefined ? undefined : { element, strip, list, items, firstId: first.id };
};

/** Reveals a selected tab using horizontal scrolling alone, including offscreen synchronized groups. */
const revealTab = ({ strip }: ITabGroup, tab: HTMLElement): void => {
  const bounds = strip.getBoundingClientRect();
  const tabBounds = tab.getBoundingClientRect();
  const left = bounds.left + strip.clientLeft;
  const right = left + strip.clientWidth;
  if (tabBounds.left < left) strip.scrollLeft += tabBounds.left - left;
  else if (tabBounds.right > right) strip.scrollLeft += tabBounds.right - right;
};

/** Applies a valid selection without changing focus or the document's scroll position. */
const selectTab = (group: ITabGroup, id: string): boolean => {
  const selected = group.items.find((item) => item.id === id);
  if (selected === undefined) return false;
  for (const item of group.items) {
    const isSelected = item === selected;
    item.tab.setAttribute('aria-selected', String(isSelected));
    item.tab.tabIndex = isSelected ? 0 : -1;
    item.panel.hidden = !isSelected;
  }
  revealTab(group, selected.tab);
  return true;
};

/**
 * Enhances complete groups into ARIA tabs while leaving all content readable if setup cannot
 * complete. One click and key listener serve the document. Remembered choices and same-key
 * groups synchronize without treating storage keys as CSS selectors. Repeated registration
 * adds no listeners; page-load events initialize newly rendered Astro groups.
 * @param root The owning document. Defaults to the page's.
 */
export const registerTabs = (root: Document = document): void => {
  const previous = initializers.get(root);
  if (previous !== undefined) {
    previous();
    return;
  }
  const groups = new WeakMap<HTMLElement, ITabGroup>();

  const initialize = (): void => {
    root.querySelectorAll<HTMLElement>('[data-tabs]').forEach((element) => {
      if (groups.has(element)) return;
      const group = readGroup(element);
      if (group === undefined) return;
      let initialId = group.firstId;
      const key = element.dataset['tabsStorageKey'];
      if (key !== undefined) {
        try {
          const stored = root.defaultView?.localStorage.getItem(key);
          if (
            stored !== undefined &&
            stored !== null &&
            group.items.some((item) => item.id === stored)
          )
            initialId = stored;
        } catch {
          /* storage failure keeps the first panel selected */
        }
      }
      group.list.setAttribute('role', 'tablist');
      for (const { tab, panel } of group.items) {
        tab.setAttribute('role', 'tab');
        tab.removeAttribute('href');
        tab.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
      }
      ownElements<HTMLElement>(element, '[data-tab-panel-label]').forEach((label) => {
        label.hidden = true;
      });
      selectTab(group, initialId);
      groups.set(element, group);
      element.setAttribute('data-tabs-ready', '');
    });
  };

  /** Chooses a group's tab and synchronizes compatible groups without moving their focus. */
  const choose = (group: ITabGroup, id: string): void => {
    selectTab(group, id);
    const key = group.element.dataset['tabsStorageKey'];
    if (key === undefined) return;
    root.querySelectorAll<HTMLElement>('[data-tabs]').forEach((element) => {
      const candidate = groups.get(element);
      if (
        candidate !== undefined &&
        element !== group.element &&
        element.dataset['tabsStorageKey'] === key
      )
        selectTab(candidate, id);
    });
    try {
      root.defaultView?.localStorage.setItem(key, id);
    } catch {
      /* the page's groups still synchronize when storage is unavailable */
    }
  };

  /** Finds an enhanced group's own activating link from a delegated event. */
  const findTarget = (
    target: EventTarget | null,
  ): { group: ITabGroup; item: ITabItem } | undefined => {
    const element = target as Partial<Element> | null;
    if (typeof element?.closest !== 'function') return undefined;
    const tab = element.closest<HTMLAnchorElement>('[data-tab-id]');
    const groupElement = tab?.closest<HTMLElement>('[data-tabs]');
    const group =
      groupElement === undefined || groupElement === null ? undefined : groups.get(groupElement);
    const item = group?.items.find((item) => item.tab === tab);
    return group === undefined || item === undefined ? undefined : { group, item };
  };

  root.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const target = findTarget(event.target);
    if (target === undefined) return;
    event.preventDefault();
    choose(target.group, target.item.id);
  });
  root.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = findTarget(event.target);
    if (target === undefined) return;
    const { group, item } = target;
    const index = group.items.indexOf(item);
    const destinations: Record<string, number> = {
      ArrowLeft: (index - 1 + group.items.length) % group.items.length,
      ArrowRight: (index + 1) % group.items.length,
      Home: 0,
      End: group.items.length - 1,
      Enter: index,
      ' ': index,
    };
    const destination = destinations[event.key];
    const next = destination === undefined ? undefined : group.items[destination];
    if (next === undefined) return;
    event.preventDefault();
    choose(group, next.id);
    next.tab.focus({ preventScroll: true });
  });
  root.addEventListener('astro:page-load', initialize);
  initializers.set(root, initialize);
  initialize();
};
