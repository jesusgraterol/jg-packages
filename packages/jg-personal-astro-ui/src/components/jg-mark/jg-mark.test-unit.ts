import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

// the standalone mark, which sites read for their favicons and social images
const SVG_FILE = new URL('jg-mark.svg', import.meta.url);

// the component, which draws the same mark inline
const COMPONENT_FILE = new URL('jg-mark.astro', import.meta.url);

/**
 * Lists the shapes an SVG draws, each as its element name and the attributes that decide how it
 * looks, in document order.
 * @param markup The SVG markup.
 * @returns The shapes.
 */
const readShapes = (markup: string): string[] =>
  [...markup.matchAll(/<(rect|path)\b([^>]*?)\/?>/g)].map(([, name = '', attributes = '']) => {
    const values = [...attributes.matchAll(/([a-z-]+)="([^"]*)"/g)]
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
  [...markup.matchAll(/<([a-zA-Z][\w:-]*)/g)].map(([, name = '']) => name);

describe('jg-mark', () => {
  test('draws the same tile and letters inline as the standalone SVG', async () => {
    const [svg, component] = await Promise.all([
      readFile(SVG_FILE, 'utf8'),
      readFile(COMPONENT_FILE, 'utf8'),
    ]);

    expect(readShapes(svg)).toHaveLength(3);
    expect(readShapes(component)).toStrictEqual(readShapes(svg));
  });

  test('uses the fixed brand colors, so it reads the same in both themes', async () => {
    const svg = await readFile(SVG_FILE, 'utf8');

    expect([...svg.matchAll(/fill="(#[0-9A-F]{6})"/g)].map(([, color]) => color)).toStrictEqual([
      '#111827',
      '#F8FAFC',
      '#6EE7B7',
    ]);
  });

  test('holds nothing a browser could run or fetch', async () => {
    for (const markup of await Promise.all([
      readFile(SVG_FILE, 'utf8'),
      readFile(COMPONENT_FILE, 'utf8'),
    ])) {
      expect(new Set(readElementNames(markup))).toStrictEqual(new Set(['svg', 'rect', 'path']));
      expect(markup).not.toMatch(/\son[a-z]+=/i);
      expect(markup).not.toMatch(/href|url\(|<script|<style/i);
    }
  });

  test('is a 64-pixel square that hides from assistive technology inline', async () => {
    const [svg, component] = await Promise.all([
      readFile(SVG_FILE, 'utf8'),
      readFile(COMPONENT_FILE, 'utf8'),
    ]);

    expect(svg).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="64" height="64" viewBox="0 0 64 64"/,
    );
    expect(component).toContain('viewBox="0 0 64 64"');
    expect(component).toContain('aria-hidden="true"');
  });
});
