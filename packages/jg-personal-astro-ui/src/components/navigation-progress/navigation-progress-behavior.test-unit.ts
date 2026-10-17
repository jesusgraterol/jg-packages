import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  isPageNavigationClick,
  registerNavigationProgress,
} from './navigation-progress-behavior.ts';

/*
 * The progress bar's behavior against a fake document and fake timers. Real navigations, which
 * the browser runs, are checked on the built site.
 */

// the page the fake clicks happen on
const LOCATION = {
  href: 'https://example.com/packages/jg-fs/',
  origin: 'https://example.com',
  pathname: '/packages/jg-fs/',
  search: '',
} as Location;

/**
 * Builds a fake click on a link.
 * @param options The link's href, target and download attribute, and the click's properties.
 * @returns The click.
 */
const createClick = ({
  href = 'https://example.com/packages/jg-sw/',
  target = '',
  download = false,
  link = true,
  ...click
}: {
  href?: string;
  target?: string;
  download?: boolean;
  link?: boolean;
  button?: number;
  defaultPrevented?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
} = {}): MouseEvent => {
  const anchor = {
    href,
    target,
    hasAttribute: (name: string) => name === 'download' && download,
  };
  return {
    button: 0,
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...click,
    target: { closest: () => (link ? anchor : null) },
  } as unknown as MouseEvent;
};

describe('isPageNavigationClick', () => {
  test('counts a plain click on a link to another page of the site', () => {
    expect(isPageNavigationClick(createClick(), LOCATION)).toBe(true);
    expect(isPageNavigationClick(createClick({ target: '_self' }), LOCATION)).toBe(true);
    // reloading the current page loads it again
    expect(
      isPageNavigationClick(createClick({ href: 'https://example.com/packages/jg-fs/' }), LOCATION),
    ).toBe(true);
    expect(isPageNavigationClick(createClick({ href: '/#packages' }), LOCATION)).toBe(true);
  });

  test.each([
    ['another button', { button: 1 }],
    ['a handled click', { defaultPrevented: true }],
    ['the meta key', { metaKey: true }],
    ['the control key', { ctrlKey: true }],
    ['the shift key', { shiftKey: true }],
    ['the alt key', { altKey: true }],
    ['a new tab', { target: '_blank' }],
    ['a download', { download: true }],
    ['another site', { href: 'https://github.com/jesusgraterol/jg-packages' }],
    ['a jump within the page', { href: 'https://example.com/packages/jg-fs/#api-reference' }],
    ['an invalid URL', { href: 'https://[' }],
    ['no link', { link: false }],
  ])('ignores %s', (_, options) => {
    expect(isPageNavigationClick(createClick(options), LOCATION)).toBe(false);
  });

  test('ignores a click without an element as its target', () => {
    const click = (target: unknown) => ({ ...createClick(), target }) as unknown as MouseEvent;

    expect(isPageNavigationClick(click(null), LOCATION)).toBe(false);
    expect(isPageNavigationClick(click({}), LOCATION)).toBe(false);
  });
});

describe('registerNavigationProgress', () => {
  /**
   * Builds a fake document with the bar, recording its listeners.
   * @param options Whether it has the bar and a window.
   * @returns The document, its bar, and a way to fire its events.
   */
  const createDocument = ({ withBar = true, withWindow = true } = {}) => {
    const attributes = new Set<string>();
    const listeners = new Map<string, ((event: Event) => void)[]>();
    const listen = (type: string, listener: (event: Event) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    };
    const bar = { hidden: true };
    const root = {
      documentElement: {
        hasAttribute: (name: string) => attributes.has(name),
        setAttribute: (name: string) => attributes.add(name),
      },
      location: LOCATION,
      querySelector: () => (withBar ? bar : null),
      addEventListener: listen,
      defaultView: withWindow ? { addEventListener: listen } : null,
    };
    const fire = (type: string, event = {} as Event) => {
      for (const listener of listeners.get(type) ?? []) listener(event);
    };
    return { root: root as unknown as Document, bar, listeners, fire };
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('shows the bar once a navigation has run 150 ms, and hides it after a 15-second stall', () => {
    const { root, bar, fire } = createDocument();
    registerNavigationProgress(root);

    fire('click', createClick());
    vi.advanceTimersByTime(149);
    expect(bar.hidden).toBe(true);
    vi.advanceTimersByTime(1);
    expect(bar.hidden).toBe(false);

    vi.advanceTimersByTime(15_000 - 150);
    expect(bar.hidden).toBe(true);
  });

  test('never shows the bar when the page comes back from the cache first', () => {
    const { root, bar, fire } = createDocument();
    registerNavigationProgress(root);

    fire('click', createClick());
    vi.advanceTimersByTime(100);
    fire('pageshow');
    vi.advanceTimersByTime(1_000);

    expect(bar.hidden).toBe(true);
  });

  test('hides the bar when a page restored from the cache still shows it', () => {
    const { root, bar, fire } = createDocument();
    registerNavigationProgress(root);

    fire('click', createClick());
    vi.advanceTimersByTime(500);
    expect(bar.hidden).toBe(false);
    fire('pageshow');

    expect(bar.hidden).toBe(true);
  });

  test('ignores clicks that load no other page', () => {
    const { root, bar, fire } = createDocument();
    registerNavigationProgress(root);

    fire('click', createClick({ target: '_blank' }));
    vi.advanceTimersByTime(1_000);

    expect(bar.hidden).toBe(true);
  });

  test('adds one listener of each kind, however many times it registers', () => {
    const { root, listeners } = createDocument();

    registerNavigationProgress(root);
    registerNavigationProgress(root);

    expect(listeners.get('click')).toHaveLength(1);
    expect(listeners.get('pageshow')).toHaveLength(1);
  });

  test('copes with a page without the bar or a window', () => {
    const { root, fire } = createDocument({ withBar: false, withWindow: false });
    registerNavigationProgress(root);

    fire('click', createClick());

    expect(() => vi.advanceTimersByTime(20_000)).not.toThrow();
  });

  test("registers on the page's document by default", () => {
    const { root, listeners } = createDocument();
    vi.stubGlobal('document', root);

    registerNavigationProgress();

    expect(listeners.get('click')).toHaveLength(1);
  });
});
