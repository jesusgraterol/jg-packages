import { afterEach, describe, expect, test, vi } from 'vitest';

import { findActiveSectionId, registerSectionTracking } from './section-tracking-behavior.ts';

/*
 * Section tracking against a fake page, where each test sets the sections' positions. Real
 * scrolling is checked in the browser test.
 */

// the sections of the fake page, in order
const SECTIONS = [
  { id: 'about', top: 0 },
  { id: 'projects', top: 0 },
  { id: 'contact', top: 0 },
];

/**
 * Builds a fake navigation link to a section.
 * @param sectionId The section it leads to.
 * @returns The link, which records its aria-current.
 */
const createLink = (sectionId: string) => {
  const attributes = new Map<string, string>([['data-section-link', sectionId]]);
  return {
    attributes,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    removeAttribute: (name: string) => attributes.delete(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  };
};

/**
 * Stubs a page with a link per section, a duplicate link to the first one, as in a mobile menu,
 * a link to a section that doesn't exist, and one that lost its section id.
 * @returns The links, the window's listeners, and setters for the scroll position.
 */
const stubPage = () => {
  const unnamed = createLink('');
  unnamed.attributes.delete('data-section-link');
  const links = [
    ...SECTIONS.map(({ id }) => createLink(id)),
    createLink('about'),
    createLink('gone'),
    unnamed,
  ];
  const listeners = new Map<string, () => void>();
  const frames: (() => void)[] = [];
  const page = { scrollY: 0, innerHeight: 800, scrollHeight: 4000 };
  vi.stubGlobal('document', {
    documentElement: {
      get scrollHeight() {
        return page.scrollHeight;
      },
    },
    getElementById: (id: string) => {
      const section = SECTIONS.find((candidate) => candidate.id === id);
      return section === undefined
        ? null
        : { id, getBoundingClientRect: () => ({ top: section.top }) };
    },
    querySelectorAll: () => links,
  });
  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    get innerHeight() {
      return page.innerHeight;
    },
    removeEventListener: (type: string) => listeners.delete(type),
    requestAnimationFrame: (callback: () => void) => frames.push(callback),
    get scrollY() {
      return page.scrollY;
    },
  });
  return { frames, links, listeners, page };
};

/**
 * Lists which sections' links are marked current.
 * @param links The links.
 * @returns The section id of each marked link.
 */
const currentLinks = (links: ReturnType<typeof createLink>[]): string[] =>
  links
    .filter((link) => link.attributes.get('aria-current') === 'location')
    .map((link) => link.attributes.get('data-section-link') ?? '');

/**
 * Places the sections, relative to the viewport's top.
 * @param tops Each section's top, in order.
 */
const placeSections = (tops: readonly number[]): void => {
  SECTIONS.forEach((section, index) => {
    section.top = tops[index] ?? 0;
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('findActiveSectionId', () => {
  test.each([
    [[100, 900, 1600], false, undefined],
    [[64, 900, 1600], false, 'about'],
    [[-500, 40, 900], false, 'projects'],
    [[-2000, -900, 30], false, 'contact'],
    [[-2000, -900, 300], true, 'contact'],
  ])('with sections at %o (at the end: %s) -> %s', (tops, isAtEnd, expected) => {
    const sections = SECTIONS.map(({ id }, index) => ({ id, top: tops[index] ?? 0 }));

    expect(findActiveSectionId(sections, 65, isAtEnd)).toBe(expected);
  });

  test('finds nothing on a page without sections, even at its end', () => {
    expect(findActiveSectionId([], 65, true)).toBeUndefined();
  });
});

describe('registerSectionTracking', () => {
  test("marks the reader's section at once, in every navigation, and follows the scroll once a frame", () => {
    placeSections([-100, 500, 1200]);
    const { frames, links, listeners, page } = stubPage();

    const stop = registerSectionTracking({ offsetHeight: 64 } as HTMLElement);
    expect(currentLinks(links)).toStrictEqual(['about', 'about']);

    placeSections([-900, -100, 600]);
    listeners.get('scroll')?.();
    listeners.get('resize')?.();
    expect(frames).toHaveLength(1);
    frames.shift()?.();
    expect(currentLinks(links)).toStrictEqual(['projects']);

    page.scrollY = 3200;
    listeners.get('hashchange')?.();
    frames.shift()?.();
    expect(currentLinks(links)).toStrictEqual(['contact']);

    stop();
    expect(listeners.size).toBe(0);
  });
});
