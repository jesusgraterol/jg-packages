import { describe, expect, test } from 'vitest';

import { insertWordBreaks } from './word-breaks.ts';

describe('insertWordBreaks', () => {
  test('lets a path or a name wrap after each separator', () => {
    expect(insertWordBreaks('node_modules/jg-fetch/API.md')).toBe(
      'node_<wbr>modules/<wbr>jg-<wbr>fetch/<wbr>API.<wbr>md',
    );
  });

  test('escapes the text before adding the breaks', () => {
    expect(insertWordBreaks('<b>&a/b')).toBe('&lt;b&gt;&amp;a/<wbr>b');
  });

  test('leaves text without separators as it is', () => {
    expect(insertWordBreaks('request')).toBe('request');
  });
});
