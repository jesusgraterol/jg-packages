import { describe, expect, test } from 'vitest';

import { buildIconTileClasses } from './icon-tile-classes.ts';

describe('buildIconTileClasses', () => {
  test('draws a card-sized primary tile by default, sizing the icon inside it', () => {
    const classes = buildIconTileClasses();

    expect(classes).toContain('bg-primary text-primary-foreground');
    expect(classes).toContain('size-10 rounded-lg [&>svg]:size-5');
  });

  test("draws a larger tile for a page's header", () => {
    expect(buildIconTileClasses('header')).toContain('size-14 rounded-xl [&>svg]:size-7');
  });

  test('sizes a compact neutral tile without the primary palette', () => {
    const classes = buildIconTileClasses('compact', 'neutral');
    expect(classes).toContain('size-8 rounded-md [&>svg]:size-4');
    expect(classes).toContain('bg-secondary text-foreground');
    expect(classes).not.toContain('bg-primary');
  });
});
