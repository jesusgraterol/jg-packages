import { afterEach, expect, test, vi } from 'vitest';

import { registerAccordionHash } from './accordion-hash.ts';

/** Builds a minimal document with nested disclosures and a mutable fragment. */
const createPage = () => {
  const order: string[] = [];
  const createDetails = (id: string, parentElement: object | null) => {
    let isOpen = false;
    return {
      tagName: 'DETAILS',
      parentElement,
      get open() {
        return isOpen;
      },
      set open(next: boolean) {
        isOpen = next;
        order.push(id);
      },
    };
  };
  const outer = createDetails('outer', null);
  const inner = createDetails('inner', outer);
  const target = {
    tagName: 'P',
    parentElement: inner,
    closest: vi.fn((): object | null => inner),
    scrollIntoView: vi.fn(),
  };
  const view = new EventTarget() as EventTarget & { location: { hash: string } };
  view.location = { hash: '#project%3Adetails' };
  const root = new EventTarget() as EventTarget & {
    defaultView: typeof view | null;
    getElementById: ReturnType<typeof vi.fn>;
  };
  root.defaultView = view;
  root.getElementById = vi.fn((id: string) => (id === 'project:details' ? target : null));
  return {
    root: root as unknown as Document,
    findById: root.getElementById,
    view,
    outer,
    inner,
    target,
    order,
  };
};

afterEach(() => vi.unstubAllGlobals());

test('initial encoded deep link opens ancestors outside-in and preserves focus', () => {
  const { root, findById, target, order, outer, inner } = createPage();
  registerAccordionHash(root);
  expect(order).toStrictEqual(['outer', 'inner']);
  expect(outer.open && inner.open).toBe(true);
  expect(findById).toHaveBeenCalledWith('project:details');
  expect(target.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
    block: 'start',
    behavior: 'instant',
  });
  registerAccordionHash(root);
  expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
});

test.each(['', '#', '#%E0%A4%A', '#missing'])(
  'invalid or absent fragment %s leaves disclosures closed',
  (hash) => {
    const { root, view, outer, inner, target } = createPage();
    view.location.hash = hash;
    registerAccordionHash(root);
    expect(outer.open || inner.open).toBe(false);
    expect(target.scrollIntoView).not.toHaveBeenCalled();
  },
);

test('unowned targets do not change another disclosure or scroll', () => {
  const { root, target, outer } = createPage();
  target.closest.mockReturnValue(null);
  registerAccordionHash(root);
  expect(outer.open).toBe(false);
  expect(target.scrollIntoView).not.toHaveBeenCalled();
});

test.each(['hashchange', 'pageshow', 'astro:page-load'])(
  '%s reveals newly collapsed ancestors',
  (type) => {
    const { root, view, outer, inner, target } = createPage();
    view.location.hash = '';
    registerAccordionHash(root);
    outer.open = true;
    view.location.hash = '#project%3Adetails';
    (type === 'astro:page-load' ? root : view).dispatchEvent(new Event(type));
    expect(inner.open).toBe(true);
    expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
  },
);

test('separately evaluated bundles share one document controller', async () => {
  const { root, view, target, inner } = createPage();
  vi.stubGlobal('document', root);
  registerAccordionHash();
  vi.resetModules();
  const second = await import('./accordion-hash.ts');
  second.registerAccordionHash(root);
  inner.open = false;
  target.scrollIntoView.mockClear();
  view.dispatchEvent(new Event('hashchange'));
  expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
});

test('documents without a browsing context need no controller', () => {
  const { root, target } = createPage();
  Object.defineProperty(root, 'defaultView', { value: null });
  registerAccordionHash(root);
  expect(target.scrollIntoView).not.toHaveBeenCalled();
});
