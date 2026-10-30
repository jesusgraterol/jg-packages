import { readFile } from 'node:fs/promises';

import { expect, test } from 'vitest';

import { JG_FAVICON_PATHS, JG_MARK_PATHS } from '../../src/brand/index.js';

import { renderBrandSvg } from './utilities.js';

test.each([
  ['jg-mark.svg', JG_MARK_PATHS],
  ['jg-favicon.svg', JG_FAVICON_PATHS],
] as const)(
  'canonical %s preserves the existing artwork and committed output',
  async (name, paths) => {
    const rendered = renderBrandSvg(paths);
    expect(rendered).toBe(
      await readFile(new URL(`../../src/assets/${name}`, import.meta.url), 'utf8'),
    );
    expect(rendered).toBe(
      await readFile(
        new URL(`../../../jg-personal-astro-ui/src/components/jg-mark/${name}`, import.meta.url),
        'utf8',
      ),
    );
    expect(rendered).not.toMatch(/<text|<script|<style|\son[a-z]+=|href=/u);
  },
);
