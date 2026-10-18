import { describe, expect, test } from 'vitest';

import { splitInlineCode } from './home-content.ts';

describe('splitInlineCode', () => {
  test('splits text into runs of prose and inline code, without empty ones', () => {
    expect(splitInlineCode('Add `## jg-packages` and read `API.md`')).toStrictEqual([
      { isCode: false, text: 'Add ' },
      { isCode: true, text: '## jg-packages' },
      { isCode: false, text: ' and read ' },
      { isCode: true, text: 'API.md' },
    ]);
  });

  test('keeps text without code as one run', () => {
    expect(splitInlineCode('Plain text.')).toStrictEqual([{ isCode: false, text: 'Plain text.' }]);
  });
});
