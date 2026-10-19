// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { createPageReturn } from './page-return.js';
import { retainSearchParams } from './utilities.js';

// an app's pages to return to, with their labels
const LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'All projects',
  '/account/support': 'Support',
  '/account/profile': 'Profile',
};

// the parameters each page keeps in its way back
const RULES: Record<string, Parameters<typeof retainSearchParams>[1]> = {
  '/projects': {
    filter: { schema: z.enum(['owned', 'member']), defaultValue: 'owned' },
    cursor: { schema: z.string().regex(/^[\w-]+$/) },
  },
  '/account/support': {
    view: { schema: z.enum(['all', 'unread']), defaultValue: 'all' },
    status: { schema: z.enum(['active', 'closed']) },
  },
};

const pageReturn = createPageReturn({
  excludedPaths: ['/sign-in', '/sign-up'],
  resolveOrigin: (url) => {
    const label = Object.hasOwn(LABELS, url.pathname) ? LABELS[url.pathname] : undefined;
    const search = retainSearchParams(url.searchParams, RULES[url.pathname] ?? {});
    if (label === undefined || search === null) {
      return null;
    }
    return { href: `${url.pathname}${search.size > 0 ? `?${search.toString()}` : ''}`, label };
  },
});

const SUPPORT_TICKET = '/account/support/41';

describe('createState', () => {
  test.each([
    [
      '/projects?filter=member&cursor=older_2&lookup=private',
      '/projects?filter=member&cursor=older_2',
    ],
    ['/projects?filter=owned', '/projects'],
    ['/projects/', '/projects'],
    [
      '/account/support?view=unread&status=active#ticket-41',
      '/account/support?view=unread&status=active',
    ],
    ['/account/profile?lookup=private', '/account/profile'],
    ['/?state=open', '/'],
  ])('records %s as %s, keeping only what the page allows', (href, expected) => {
    expect(pageReturn.createState(href, { retained: true })).toStrictEqual({
      retained: true,
      pageReturn: { href: expected },
    });
  });

  test.each([
    'https://example.com/projects',
    '//example.com/projects',
    '/\\example.com',
    '/%ZZ',
    '/constructor',
    '/sign-in',
    '/sign-up/step',
    '/unknown',
    '/projects//',
    '/projects?filter=unknown',
    '/projects?cursor=bad%20cursor',
    '/projects?filter=owned&filter=member',
    '/account/support?view=all&view=unread',
    42,
  ])('records no origin for %s', (href) => {
    expect(pageReturn.createState(href as string, { retained: true })).toStrictEqual({
      retained: true,
      pageReturn: undefined,
    });
  });

  test('replaces an earlier origin, and starts from no state when it is not an object', () => {
    expect(
      pageReturn.createState('/projects?filter=member', {
        retained: true,
        pageReturn: { href: '/account/profile' },
      }),
    ).toStrictEqual({ retained: true, pageReturn: { href: '/projects?filter=member' } });
    expect(pageReturn.createState('/projects', 'state')).toStrictEqual({
      pageReturn: { href: '/projects' },
    });
  });

  test("records no origin when the app's own href or label isn't valid", () => {
    const resolveOrigin = vi.fn();
    const unsafe = createPageReturn({ resolveOrigin });

    resolveOrigin.mockReturnValueOnce({ href: '//evil.example', label: 'Evil' });
    expect(unsafe.normalizeOrigin('/projects')).toBeNull();
    resolveOrigin.mockReturnValueOnce({ href: '/projects', label: '' });
    expect(unsafe.normalizeOrigin('/projects')).toBeNull();
    resolveOrigin.mockReturnValueOnce({ href: '/projects', label: 7 });
    expect(unsafe.normalizeOrigin('/projects')).toBeNull();
  });

  test('keeps its origin under another state key', () => {
    const custom = createPageReturn({
      stateKey: 'returnTo',
      resolveOrigin: () => ({ href: '/', label: 'Home' }),
    });

    expect(custom.createState('/anything')).toStrictEqual({ returnTo: { href: '/' } });
  });
});

describe('resolve', () => {
  test('gives the origin with its label, and the state without it, so it is used once', () => {
    const state = pageReturn.createState('/account/support?view=unread&status=active', {
      retained: true,
    });

    expect(pageReturn.resolve(state, SUPPORT_TICKET)).toStrictEqual({
      returnTo: { href: '/account/support?view=unread&status=active', label: 'Support' },
      returnState: { retained: true },
    });
  });

  test('offers no way back to the parent, the current page, or the current pathname', () => {
    const toSupport = pageReturn.createState('/account/support');
    const toFilteredSupport = pageReturn.createState('/account/support?view=unread');

    expect(
      pageReturn.resolve(toSupport, SUPPORT_TICKET, { parentHref: '/account/support' }).returnTo,
    ).toBeNull();
    expect(
      pageReturn.resolve(toFilteredSupport, '/account/support?view=unread').returnTo,
    ).toBeNull();
    expect(pageReturn.resolve(toFilteredSupport, '/account/support?view=all').returnTo).toBeNull();
    expect(pageReturn.resolve(toFilteredSupport, '/account/support/').returnTo).toBeNull();
    expect(
      pageReturn.resolve(toFilteredSupport, SUPPORT_TICKET, { parentHref: '/somewhere-else' })
        .returnTo,
    ).toStrictEqual({ href: '/account/support?view=unread', label: 'Support' });
  });

  test.each([
    ['no state', undefined],
    ['state that is not an object', 'state'],
    ['no origin', { retained: true }],
    ['an origin that is not an object', { pageReturn: '/projects' }],
    ['an origin without an href', { pageReturn: {} }],
    ['an origin with another field', { pageReturn: { href: '/projects', projectId: '42' } }],
    ['an origin the app does not accept', { pageReturn: { href: '/unknown' } }],
    ['an unsafe origin', { pageReturn: { href: '//evil.example' } }],
  ])('offers no way back for %s', (_, state) => {
    expect(pageReturn.resolve(state, SUPPORT_TICKET).returnTo).toBeNull();
  });

  test('offers no way back to the root from the root, and one to it from elsewhere', () => {
    const toDashboard = pageReturn.createState('/');

    expect(pageReturn.resolve(toDashboard, '/').returnTo).toBeNull();
    expect(pageReturn.resolve(toDashboard, '/account/profile').returnTo).toStrictEqual({
      href: '/',
      label: 'Dashboard',
    });
  });

  test('gives no state to return with when the current state is not an object', () => {
    expect(pageReturn.resolve(undefined, SUPPORT_TICKET).returnState).toBeUndefined();
  });
});
