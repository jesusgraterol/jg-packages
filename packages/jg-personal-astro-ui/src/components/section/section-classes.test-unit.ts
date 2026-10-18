import { describe, expect, test } from 'vitest';

import { buildSectionClasses } from './section-classes.ts';

describe('buildSectionClasses', () => {
  test('defaults to a bordered page-width section with a stacked header at the start', () => {
    expect(buildSectionClasses()).toStrictEqual({
      root: 'jg-section-space scroll-mt-16 border-b border-border',
      container: 'jg-container',
      header: 'max-w-3xl',
      title: 'section-title mt-4',
      lede: 'lede mt-5',
    });
  });

  test('drops the border, and narrows to the reading column', () => {
    const classes = buildSectionClasses({ border: false, width: 'prose' });

    expect(classes.root).toBe('jg-section-space scroll-mt-16');
    expect(classes.container).toBe('jg-container-prose');
  });

  test('centers a stacked header, its lede included', () => {
    const classes = buildSectionClasses({ align: 'center' });

    expect(classes.header).toBe('mx-auto max-w-3xl text-center');
    expect(classes.lede).toBe('lede mx-auto mt-5');
  });

  test.each(['start', 'center'] as const)(
    'splits the header into two columns from lg, whatever the alignment (%s)',
    (align) => {
      const classes = buildSectionClasses({ align, layout: 'split' });

      expect(classes.header).toBe('grid gap-4 lg:grid-cols-[0.42fr_1fr] lg:gap-x-10');
      expect(classes.title).toBe('section-title');
      expect(classes.lede).toBe('lede mt-5');
    },
  );
});
