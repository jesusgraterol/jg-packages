import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

// the standalone mark, which agenticcoding's favicon and social images are generated from
const SVG_FILE = new URL('agentic-coding-mark.svg', import.meta.url);

// the component, which draws the same mark inline
const COMPONENT_FILE = new URL('agentic-coding-mark.astro', import.meta.url);

/**
 * Lists the shapes an SVG draws, each as its element name and the attributes that decide how it
 * looks, in document order.
 * @param markup The SVG markup.
 * @returns The shapes.
 */
const readShapes = (markup: string): string[] =>
  [...markup.matchAll(/<(rect|path)\b([^>]*?)\/?>/gu)].map(([, name = '', attributes = '']) => {
    const values = [...attributes.matchAll(/([a-z-]+)="([^"]*)"/gu)]
      .map(([, key = '', value = '']) => `${key}=${value}`)
      .toSorted();
    return `${name} ${values.join(' ')}`;
  });

/**
 * Lists the element names in SVG markup.
 * @param markup The SVG markup.
 * @returns The names of every element, in document order.
 */
const readElementNames = (markup: string): string[] =>
  [...markup.matchAll(/<([a-zA-Z][\w:-]*)/gu)].map(([, name = '']) => name);

describe('agentic-coding-mark', () => {
  test(
    'draws the same tile, chevrons, and node inline as the standalone SVG',
    { tags: ['full'] },
    async () => {
      const [svg, component] = await Promise.all([
        readFile(SVG_FILE, 'utf8'),
        readFile(COMPONENT_FILE, 'utf8'),
      ]);

      expect(readShapes(svg)).toHaveLength(4);
      expect(readShapes(component)).toStrictEqual(readShapes(svg));
    },
  );

  test(
    'uses the brand colors as fixed values, so it reads the same in both themes',
    { tags: ['full'] },
    async () => {
      const svg = await readFile(SVG_FILE, 'utf8');

      expect(
        [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/gu)].map(([, color]) => color),
      ).toStrictEqual(['#111111', '#f4f6f1', '#76c8ad', '#ef6047']);
    },
  );

  test('holds nothing a browser could run or fetch', async () => {
    for (const markup of await Promise.all([
      readFile(SVG_FILE, 'utf8'),
      readFile(COMPONENT_FILE, 'utf8'),
    ])) {
      expect(new Set(readElementNames(markup))).toStrictEqual(new Set(['svg', 'rect', 'path']));
      expect(markup).not.toMatch(/\son[a-z]+=/iu);
      expect(markup).not.toMatch(/href|url\(|<script|<style/iu);
    }
  });

  test(
    'is a 64-pixel square that hides from assistive technology inline',
    { tags: ['full'] },
    async () => {
      const [svg, component] = await Promise.all([
        readFile(SVG_FILE, 'utf8'),
        readFile(COMPONENT_FILE, 'utf8'),
      ]);

      expect(svg).toMatch(
        /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="64" height="64" viewBox="0 0 64 64"/u,
      );
      expect(component).toContain('viewBox="0 0 64 64"');
      expect(component).toContain('aria-hidden="true"');
    },
  );
});
