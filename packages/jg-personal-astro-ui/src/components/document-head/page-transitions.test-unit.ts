import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

import { PAGE_TRANSITION_STYLE } from './page-transitions.ts';

// the stylesheet whose page-transition rules document-head repeats
const CONTRACT_FILE = new URL('../../styles/contract.css', import.meta.url);

/**
 * Removes a stylesheet's comments and the whitespace and final semicolons that don't change it.
 * @param css The CSS.
 * @returns The compacted CSS.
 */
const compactCss = (css: string): string =>
  css
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\s+/gu, ' ')
    .replace(/\s*([{}:;,])\s*/gu, '$1')
    .replace(/;\}/gu, '}')
    .trim();

/**
 * Lists a stylesheet's @view-transition rules, each after the at-rules that contain it, such as
 * `@media (prefers-reduced-motion:reduce) @view-transition{navigation:none}`.
 * @param css The CSS, without strings that hold braces or semicolons.
 * @returns The rules, in source order.
 */
const listViewTransitionRules = (css: string): string[] => {
  const source = compactCss(css);
  const rules: string[] = [];
  const blocks: { prelude: string; bodyStart: number }[] = [];
  let preludeStart = 0;
  // reads UTF-16 code units, the positions slice() takes
  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);
    if (character === '{') {
      blocks.push({ prelude: source.slice(preludeStart, index), bodyStart: index + 1 });
    } else if (character === '}') {
      const block = blocks.pop();
      if (block?.prelude === '@view-transition') {
        const body = source.slice(block.bodyStart, index);
        rules.push(
          [...blocks.map(({ prelude }) => prelude), `@view-transition{${body}}`].join(' '),
        );
      }
    }
    if (character === '{' || character === '}' || character === ';') preludeStart = index + 1;
  }
  return rules;
};

describe('PAGE_TRANSITION_STYLE', () => {
  test("repeats contract.css's page-transition opt-in and its reduced-motion opt-out", async () => {
    const contractRules = listViewTransitionRules(await readFile(CONTRACT_FILE, 'utf8'));

    expect(contractRules).toStrictEqual([
      '@view-transition{navigation:auto}',
      '@media (prefers-reduced-motion:reduce) @view-transition{navigation:none}',
    ]);
    expect(listViewTransitionRules(PAGE_TRANSITION_STYLE)).toStrictEqual(contractRules);
  });
});
