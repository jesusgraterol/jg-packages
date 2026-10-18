import { describe, expect, test } from 'vitest';

import { BADGE_DOT_CLASSES, buildBadgeClasses } from './badge-classes.ts';

describe('buildBadgeClasses', () => {
  test('sets a secondary label in the mono font by default, as before', () => {
    const classes = buildBadgeClasses();

    expect(classes).toContain('font-mono');
    expect(classes).toContain('bg-secondary');
  });

  test('sets the label in the page font when it is not mono', () => {
    expect(buildBadgeClasses('neutral', false)).not.toContain('font-mono');
  });

  test('draws the neutral variant on the surface, with a hairline', () => {
    expect(buildBadgeClasses('neutral')).toContain('border-border bg-surface text-foreground');
  });

  test("colours the status dot with the label's colour", () => {
    expect(BADGE_DOT_CLASSES).toContain('bg-current');
  });
});
