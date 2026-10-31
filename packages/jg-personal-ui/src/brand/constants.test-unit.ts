import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'vitest';

// the standalone mark, which sites read for their social images
const SVG_FILE = new URL('../assets/jg-mark.svg', import.meta.url);

// the favicon: the mark's slash alone, large enough to read at 16 pixels
const FAVICON_FILE = new URL('../assets/jg-favicon.svg', import.meta.url);

// how much larger the favicon's slash is than the mark's
const FAVICON_SCALE = 1.55;

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
      .sort();
    return `${name} ${values.join(' ')}`;
  });

/**
 * Lists the element names in SVG markup.
 * @param markup The SVG markup.
 * @returns The names of every element, in document order.
 */
const readElementNames = (markup: string): string[] =>
  [...markup.matchAll(/<([a-zA-Z][\w:-]*)/g)].map(([, name = '']) => name);

/**
 * Reads the corners of a path drawn as straight lines, such as the mark's slash.
 * @param markup The SVG markup.
 * @param fill The path's fill, which tells the paths apart.
 * @returns The corners, as [x, y] pairs.
 */
const readCorners = (markup: string, fill: string): [number, number][] => {
  const data = new RegExp(`fill="${fill}" d="([^"]*)"`).exec(markup)?.[1] ?? '';
  return [...data.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(([, x = '', y = '']) => [
    Number(x),
    Number(y),
  ]);
};

describe('jg-mark', () => {
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
      readFile(FAVICON_FILE, 'utf8'),
    ])) {
      expect(new Set(readElementNames(markup))).toStrictEqual(new Set(['svg', 'rect', 'path']));
      expect(markup).not.toMatch(/\son[a-z]+=/i);
      expect(markup).not.toMatch(/href|url\(|<script|<style/i);
    }
  });

  test('is a 64-pixel standalone square', async () => {
    const [svg] = await Promise.all([readFile(SVG_FILE, 'utf8')]);

    expect(svg).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="64" height="64" viewBox="0 0 64 64"/,
    );
  });

  test("draws the favicon as the mark's tile and its slash alone, scaled about the center", async () => {
    const [svg, favicon] = await Promise.all([
      readFile(SVG_FILE, 'utf8'),
      readFile(FAVICON_FILE, 'utf8'),
    ]);
    const slash = readCorners(svg, '#6EE7B7');
    const center = slash
      .reduce(([sumX, sumY], [x, y]) => [sumX + x, sumY + y], [0, 0])
      .map((sum) => sum / slash.length);

    expect(favicon).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="64" height="64" viewBox="0 0 64 64"/,
    );
    expect(readShapes(favicon)).toStrictEqual([
      readShapes(svg)[0],
      expect.stringMatching(/^path /),
    ]);
    const faviconSlash = readCorners(favicon, '#6EE7B7');
    expect(slash).toHaveLength(4);
    expect(faviconSlash).toHaveLength(4);
    faviconSlash.forEach(([x, y], index) => {
      const [markX = 0, markY = 0] = slash[index] ?? [];
      expect(x).toBeCloseTo(32 + (markX - (center[0] ?? 0)) * FAVICON_SCALE, 1);
      expect(y).toBeCloseTo(32 + (markY - (center[1] ?? 0)) * FAVICON_SCALE, 1);
    });
  });
});
