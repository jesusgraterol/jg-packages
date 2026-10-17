import { describe, expect, test } from 'vitest';

import { SPECULATION_RULES } from './speculation-rules.ts';

describe('SPECULATION_RULES', () => {
  test('prerenders same-site pages when the pointer rests on their links', () => {
    const parsed: unknown = JSON.parse(JSON.stringify(SPECULATION_RULES));

    expect(parsed).toStrictEqual({
      prerender: [
        {
          where: {
            and: [
              { href_matches: '/*' },
              { not: { href_matches: '/*.md' } },
              { not: { href_matches: '/*.txt' } },
              { not: { href_matches: '/*.xml' } },
              { not: { href_matches: '/*.png' } },
            ],
          },
          eagerness: 'moderate',
        },
      ],
    });
  });
});
