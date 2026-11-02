// @vitest-environment node
import { createElement } from 'react';
import { describe, expect, test } from 'vitest';

import { extractCodeText, isCodeBlockProse, resolveCodeBlockLanguageLabel } from './utilities.js';

describe('isCodeBlockProse', () => {
  test.each([
    ['/moldea/project.md', undefined, true],
    ['notes.MARKDOWN', undefined, true],
    ['notes.mdx', undefined, true],
    ['notes.txt', undefined, true],
    ['notes.text', undefined, true],
    [undefined, 'text', true],
    [undefined, 'plaintext', true],
    [undefined, ' txt ', true],
    [undefined, 'Markdown', true],
    [undefined, 'md', true],
    [undefined, undefined, false],
    ['source.unknown', undefined, false],
    ['source.ts', 'typescript', false],
    ['source.yaml', 'yaml', false],
    ['notes.md.backup', undefined, false],
    [undefined, 'diff-markdown', false],
  ])('isCodeBlockProse(%s, %s) -> %s', { tags: ['full'] }, (path, language, expected) => {
    expect(isCodeBlockProse(path, language)).toBe(expected);
  });
});

test('extractCodeText preserves nested source and ignores nontext React values', () => {
  expect(
    extractCodeText([
      'first',
      2,
      null,
      undefined,
      false,
      createElement('em', null, ' nested'),
      new Set(['ignored']),
    ]),
  ).toBe('first2 nested');
});

test('unknown diff grammars retain their authored label', { tags: ['full'] }, () => {
  expect(resolveCodeBlockLanguageLabel('diff-custom')).toBe('Diff (custom)');
});
