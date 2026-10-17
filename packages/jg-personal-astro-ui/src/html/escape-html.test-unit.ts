import { describe, expect, test } from 'vitest';

import { escapeHtml } from './escape-html.ts';

describe('escapeHtml', () => {
  test('escapes the characters HTML gives a meaning', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});
