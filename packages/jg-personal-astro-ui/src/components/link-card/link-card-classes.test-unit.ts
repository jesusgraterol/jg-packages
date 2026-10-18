import { describe, expect, test } from 'vitest';

import { buildLinkCardArrowClasses, buildLinkCardLinkAttributes } from './link-card-classes.ts';

describe('link card', () => {
  test('opens a link to another site in a new tab, without a referrer', () => {
    expect(buildLinkCardLinkAttributes(true)).toStrictEqual({
      rel: 'noreferrer',
      target: '_blank',
    });
    expect(buildLinkCardLinkAttributes(false)).toStrictEqual({});
  });

  test("puts an external card's arrow in its corner, and nudges an internal card's on hover", () => {
    expect(buildLinkCardArrowClasses(true)).toContain('absolute top-5 right-5');
    expect(buildLinkCardArrowClasses(false)).toContain('group-hover:translate-x-0.5');
  });
});
