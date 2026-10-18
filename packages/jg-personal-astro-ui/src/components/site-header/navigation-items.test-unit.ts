import { describe, expect, test } from 'vitest';

import { findItemSectionId, isCurrentItem } from './navigation-items.ts';

describe('isCurrentItem', () => {
  test.each([
    [{ href: '/packages/', label: 'Packages' }, '/packages/', true],
    [{ href: '/packages/', label: 'Packages' }, '/packages/jg-fs/', false],
    [{ href: '/cookbook/', label: 'Cookbook', match: 'prefix' as const }, '/cookbook/', true],
    [{ href: '/cookbook/', label: 'Cookbook', match: 'prefix' as const }, '/cookbook/x/', true],
    [{ href: '/cookbook', label: 'Cookbook', match: 'prefix' as const }, '/cookbook/x/', true],
    [{ href: '/cookbook/', label: 'Cookbook', match: 'prefix' as const }, '/cookbooks/', false],
    [{ href: '/', label: 'Home', match: 'prefix' as const }, '/cookbook/', false],
    [{ href: '/', label: 'Home', match: 'prefix' as const }, '/', true],
    [{ external: true, href: '/skills/', label: 'Skills' }, '/skills/', false],
  ])('isCurrentItem(%o, %s) -> %s', (item, currentPath, expected) => {
    expect(isCurrentItem(item, currentPath)).toBe(expected);
  });

  test('marks nothing without a current path', () => {
    expect(isCurrentItem({ href: '/', label: 'Home' }, undefined)).toBe(false);
  });
});

describe('findItemSectionId', () => {
  test.each([
    ['#about', '/', 'about'],
    ['/#about', '/', 'about'],
    ['/#about', '/404/', undefined],
    ['/about/', '/', undefined],
    ['#', '/', undefined],
    ['/projects/#tags', '/projects/', 'tags'],
  ])('findItemSectionId(%s on %s) -> %s', (href, currentPath, expected) => {
    expect(findItemSectionId({ href, label: 'Link' }, currentPath)).toBe(expected);
  });

  test('never tracks an external item', () => {
    expect(findItemSectionId({ external: true, href: '#about', label: 'About' }, '/')).toBe(
      undefined,
    );
  });
});
