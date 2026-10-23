import { describe, expect, test } from 'vitest';

import { buildPageHeaderClasses } from './page-header-classes.ts';

describe('buildPageHeaderClasses', () => {
  test('starts the header at the page column, by default', () => {
    expect(buildPageHeaderClasses()).toStrictEqual({
      container: 'jg-container pt-8 pb-12 sm:pt-10 sm:pb-16',
      row: 'flex items-center gap-4 sm:gap-5',
      lede: 'lede mt-5',
      title: 'jg-page-title mt-2',
    });
  });

  test('uses the document scale without changing the centered layout', () => {
    const classes = buildPageHeaderClasses('center', 'document');
    expect(classes.title).toBe('jg-document-title mt-2');
    expect(classes.container).toBe('jg-container pt-8 pb-12 text-center sm:pt-10 sm:pb-16');
  });

  test('centers the text, the title row, and the lede', () => {
    const classes = buildPageHeaderClasses('center');

    expect(classes.container).toContain('text-center');
    expect(classes.row).toContain('justify-center');
    expect(classes.lede).toBe('lede mx-auto mt-5');
  });
});
