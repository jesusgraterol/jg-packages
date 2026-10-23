import { describe, expect, test } from 'vitest';

import {
  highlightToHtml,
  highlightToLines,
  renderLineTokens,
  toSupportedLanguage,
} from './highlighting.ts';

describe('toSupportedLanguage', () => {
  test.each([
    ['typescript', 'typescript'],
    ['ts', 'typescript'],
    [' TS ', 'typescript'],
    ['sh', 'bash'],
    ['yml', 'yaml'],
    ['astro', 'astro'],
    ['cobol', 'text'],
    ['', 'text'],
  ])('maps %o to %o', (language, expected) => {
    expect(toSupportedLanguage(language)).toBe(expected);
  });
});

describe('highlightToHtml', () => {
  test('applies component-owned pre attributes through the shared highlighter', async () => {
    const html = await highlightToHtml('<tag>', 'text', [
      {
        pre(node) {
          node.properties['dataCodeBody'] = '';
          node.properties['role'] = 'region';
          node.properties['ariaLabel'] = 'Source "<tag>"';
        },
      },
    ]);
    expect(html).toContain('data-code-body=""');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Source &#x22;<tag>&#x22;"');
    expect(html).toContain('tabindex="0"');
  });
  test('colours tokens with --jg-syntax-* variables, without a trailing empty line', async () => {
    const html = await highlightToHtml('const a = 1;\n', 'ts');

    expect(html).toMatch(/^<pre class="shiki jg-syntax"/);
    expect(html).toContain('var(--jg-syntax-');
    expect(html.match(/class="line"/g)).toHaveLength(1);
  });

  test('renders an unknown language as plain text', async () => {
    const html = await highlightToHtml('a <b> c', 'cobol');

    expect(html).toContain('a &#x3C;b> c');
    expect(html).not.toContain('var(--jg-syntax-token');
  });
});

describe('highlightToLines', () => {
  test("returns each line's tokens, without a trailing empty line", async () => {
    const lines = await highlightToLines('const a = 1;\nconst b = 2;\n', 'typescript');

    expect(lines).toHaveLength(2);
    expect(lines[0]?.map(({ content }) => content).join('')).toBe('const a = 1;');
  });
});

describe('renderLineTokens', () => {
  test('wraps coloured tokens in spans and escapes every token', () => {
    expect(
      renderLineTokens([
        { content: 'if', color: 'var(--jg-syntax-keyword)', offset: 0 },
        { content: ' a < b', offset: 2 },
      ]),
    ).toBe('<span style="color:var(--jg-syntax-keyword)">if</span> a &lt; b');
  });
});
