import { describe, expect, test } from 'vitest';

import { renderDocText } from './api-reference.ts';

describe('renderDocText', () => {
  test('escapes HTML, turns backticks into code, and splits paragraphs', () => {
    expect(renderDocText('Reads a `<file>` from\ndisk.\n\nThen <closes> it.')).toBe(
      '<p>Reads a <code>&lt;file&gt;</code> from disk.</p><p>Then &lt;closes&gt; it.</p>',
    );
  });
});
