import { describe, expect, test } from 'vitest';

import { renderCodeWindowHeader } from '../components/code-block/code-window.ts';
import { codeWindowPlugin, readCodeLanguage } from './code-window-plugin.ts';

/**
 * Builds a hast code block.
 * @param properties The pre element's properties.
 * @param codeClassName The code element's className, if any.
 * @returns The code block.
 */
const createPre = (
  properties: Record<string, unknown> = {},
  codeClassName?: unknown,
): Parameters<typeof readCodeLanguage>[0] => ({
  type: 'element',
  tagName: 'pre',
  properties,
  children: [
    { type: 'text', value: '\n' },
    {
      type: 'element',
      tagName: 'code',
      properties: codeClassName === undefined ? {} : { className: codeClassName },
      children: [{ type: 'text', value: 'const a = 1;' }],
    },
  ],
});

describe('readCodeLanguage', () => {
  test("reads the language Astro's highlighter sets", () => {
    expect(readCodeLanguage(createPre({ dataLanguage: 'ts' }, ['language-js']))).toBe('ts');
  });

  test('falls back to the language class of the code element', () => {
    expect(readCodeLanguage(createPre({ dataLanguage: '' }, ['x', 'language-bash']))).toBe('bash');
  });

  test('reads text for a block without a language', () => {
    expect(readCodeLanguage(createPre())).toBe('text');
    expect(readCodeLanguage(createPre({}, 'language-js'))).toBe('text');
    expect(readCodeLanguage(createPre({}, ['other', 1]))).toBe('text');
    expect(readCodeLanguage(createPre({}, ['language-']))).toBe('text');
    expect(readCodeLanguage({ type: 'element', tagName: 'pre', children: [null, 'x'] })).toBe(
      'text',
    );
    expect(readCodeLanguage({ type: 'element', tagName: 'pre' })).toBe('text');
  });
});

describe('codeWindowPlugin', () => {
  test('visits every pre element', () => {
    expect(codeWindowPlugin.name).toBe('jg-code-window');
    expect(codeWindowPlugin.element.filter).toStrictEqual(['pre']);
  });

  test('puts a code block in a code window, captioned with its language', () => {
    const pre = createPre({ dataLanguage: 'ts' });

    expect(codeWindowPlugin.element.visit(pre)).toStrictEqual({
      type: 'element',
      tagName: 'figure',
      properties: { className: ['jg-code-window'], dataCodeWindow: '' },
      children: [{ type: 'raw', value: renderCodeWindowHeader({ caption: 'ts' }) }, pre],
    });
  });
});
