import { expect, test } from 'vitest';

import { resolveSafeInternalPath } from './internal-path.js';

// the cases Moldea's resolveSafeInternalPath is tested with, against the same excluded path
test.each([
  ['/projects/a?tab=files#readme', '/projects/a?tab=files#readme'],
  ['/projects/../account', '/account'],
  ['/sign-in-help', '/sign-in-help'],
  ['/sign-in', null],
  ['/sign-in?next=/projects', null],
  ['/sign-in/step', null],
  ['/%73ign-in', null],
  ['/SIGN-IN', null],
  ['/projects/../sign-in', null],
  ['/%E0%A4%A', null],
  ['https://example.com', null],
  ['//example.com', null],
  ['/\\example.com', null],
  ['/%5cexample.com', null],
  ['/projects%5Cother', null],
  ['projects', null],
  ['', null],
  [undefined, null],
  [null, null],
  [{ pathname: '/projects' }, null],
])('resolveSafeInternalPath(%o) -> %o', (candidate, expected) => {
  expect(resolveSafeInternalPath(candidate, ['/sign-in'])).toBe(expected);
});

test.each([
  ['/sign-in/', null],
  ['/Sign-Up/Verify', null],
  ['/sign-upgrade', '/sign-upgrade'],
  ['/\t/example.com', null],
  ['/', '/'],
])(
  'matches excluded paths with a trailing slash too: resolveSafeInternalPath(%o) -> %o',
  (candidate, expected) => {
    expect(resolveSafeInternalPath(candidate, ['/sign-in', '/sign-up/'])).toBe(expected);
  },
);

test('accepts every internal path when nothing is excluded', () => {
  expect(resolveSafeInternalPath('/sign-in')).toBe('/sign-in');
});
