// @vitest-environment node
import { createElement } from 'react';
import { describe, expect, test } from 'vitest';

import { getMarkdownImageDisplayWidth } from './index.js';
import {
  extractMarkdownText,
  highlightMarkdownVariablesRehypePlugin,
  isMarkdownWebNavigationHref,
  mergeSecureMarkdownLinkRel,
} from './utilities.js';

describe('getMarkdownImageDisplayWidth', () => {
  test.each([
    ['width=560', 560],
    ['width=1', 1],
    ['width=0', undefined],
    ['width=-560', undefined],
    ['width=560.5', undefined],
    ['width=560px', undefined],
    ['width=9007199254740992', undefined],
    ['width=560; color:red', undefined],
    ['width=560 extra', undefined],
    ['Diagram at width=560', undefined],
    ['System diagram', undefined],
    [undefined, undefined],
  ])('getMarkdownImageDisplayWidth(%s) -> %s', { tags: ['full'] }, (title, expectedWidth) => {
    expect(getMarkdownImageDisplayWidth(title)).toBe(expectedWidth);
  });
});

describe('isMarkdownWebNavigationHref', () => {
  test.each([
    'https://moldea.ai/knowledge-base',
    'http://localhost:3000/knowledge-base',
    '//moldea.ai/knowledge-base',
    '/knowledge-base',
    'knowledge-base',
    './knowledge-base',
    '../knowledge-base',
    '?category=security',
    '/knowledge-base#security',
    '  https://moldea.ai/knowledge-base  ',
  ])('isMarkdownWebNavigationHref(%s) -> true', (href) => {
    expect(isMarkdownWebNavigationHref(href)).toBe(true);
  });

  test.each([
    ['#security'],
    ['mailto:jesus@moldea.ai'],
    ['tel:+15551234567'],
    ['ftp://files.example.com/guide'],
    ['data:text/plain,guide'],
    ['blob:https://moldea.ai/resource-id'],
    ['https://'],
    [''],
    ['   '],
    [undefined],
  ])('isMarkdownWebNavigationHref(%s) -> false', (href) => {
    expect(isMarkdownWebNavigationHref(href)).toBe(false);
  });
});

describe('mergeSecureMarkdownLinkRel', () => {
  test.each([
    [undefined, ['noopener', 'noreferrer']],
    ['', ['noopener', 'noreferrer']],
    ['nofollow sponsored', ['nofollow', 'sponsored', 'noopener', 'noreferrer']],
    ['NoOpener sponsored NOREFERRER', ['NoOpener', 'sponsored', 'NOREFERRER']],
  ])('mergeSecureMarkdownLinkRel(%s) -> secure relation', (rel, expectedTokens) => {
    expect(mergeSecureMarkdownLinkRel(rel).split(' ')).toStrictEqual(expectedTokens);
  });
});

test('extractMarkdownText preserves nested text and ignores nontext React values', () => {
  expect(
    extractMarkdownText([
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

test('variable highlighting ignores malformed roots without changing their identity', () => {
  const transform = highlightMarkdownVariablesRehypePlugin();
  for (const tree of [null, 'text', { unrelated: true }]) expect(transform(tree)).toBeUndefined();
});

test('large variable documents do not depend on the engine function-argument limit', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'p',
        children: [{ type: 'text', value: '{{A}}'.repeat(131072) }],
      },
    ],
  };
  highlightMarkdownVariablesRehypePlugin()(tree);
  expect(tree.children[0]?.children).toHaveLength(131072);
  expect(tree.children[0]?.children.at(-1)).toMatchObject({
    type: 'element',
    tagName: 'mark',
    children: [{ type: 'text', value: '{{A}}' }],
  });
});
