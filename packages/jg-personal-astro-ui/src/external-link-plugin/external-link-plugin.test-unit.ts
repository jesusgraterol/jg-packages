import { describe, expect, test } from 'vitest';

import { renderNewTabMarker } from '../components/new-tab-marker/new-tab-marker-markup.ts';
import { externalLinkPlugin, isExternalHref } from './external-link-plugin.ts';

// a hast link, as the plugin's tests build it
type ILink = {
  type: 'element';
  tagName: 'a';
  properties: Record<string, unknown>;
  children: unknown[];
};

const plugin = externalLinkPlugin({ siteUrl: 'https://example.com/docs/' });

/**
 * Runs the plugin on a link, applying its changes as Sätteri would.
 * @param properties The link's properties.
 * @returns The link after the plugin ran.
 */
const visitLink = (properties: Record<string, unknown>): ILink => {
  const link: ILink = {
    type: 'element',
    tagName: 'a',
    properties: { ...properties },
    children: [{ type: 'text', value: 'Docs' }],
  };
  plugin.element.visit(link, {
    appendChild: (node, child) => {
      node.children.push(child);
    },
    setProperty: (node, key, value) => {
      node.properties[key] = value;
    },
  });
  return link;
};

describe('externalLinkPlugin', () => {
  test('visits every link', () => {
    expect(plugin.name).toBe('jg-external-link');
    expect(plugin.element.filter).toStrictEqual(['a']);
  });

  test.each(['https://github.com/jesusgraterol', 'HTTP://example.org/a?b=1#c'])(
    'opens %s, on another origin, in a new tab, ending with the marker',
    (href) => {
      expect(visitLink({ href })).toStrictEqual({
        type: 'element',
        tagName: 'a',
        properties: { href, target: '_blank', rel: ['noreferrer'] },
        children: [
          { type: 'text', value: 'Docs' },
          { type: 'raw', value: renderNewTabMarker() },
        ],
      });
    },
  );

  test.each([
    ['a list', ['nofollow'], ['nofollow', 'noreferrer']],
    ['a string', 'nofollow  me', ['nofollow', 'me', 'noreferrer']],
    ['noreferrer already', ['noreferrer'], ['noreferrer']],
    ['something else', 1, ['noreferrer']],
  ])('keeps the rel tokens of a link with %s, adding noreferrer', (_, rel, expected) => {
    expect(visitLink({ href: 'https://github.com/', rel }).properties['rel']).toStrictEqual(
      expected,
    );
  });

  test.each([
    ['on the same origin', 'https://example.com/packages/'],
    ['on the same origin, with its default port written out', 'https://example.com:443/'],
    ['relative', '/packages/jg-fs/'],
    ['a fragment', '#install'],
    ['protocol-relative', '//github.com/'],
    ['mailto:', 'mailto:hello@example.com'],
    ['tel:', 'tel:+15555550123'],
    ['not a URL', 'https://'],
    ['without an href', undefined],
  ])('leaves a link %s alone', (_, href) => {
    const properties = href === undefined ? {} : { href };

    expect(visitLink(properties)).toStrictEqual({
      type: 'element',
      tagName: 'a',
      properties,
      children: [{ type: 'text', value: 'Docs' }],
    });
  });

  test.each(['_self', '_blank', ''])(
    'leaves a link that already has a target (%o) as it is',
    (target) => {
      const properties = { href: 'https://github.com/', target, rel: ['author'] };

      expect(visitLink(properties)).toStrictEqual({
        type: 'element',
        tagName: 'a',
        properties,
        children: [{ type: 'text', value: 'Docs' }],
      });
    },
  );

  test('treats a link with no properties as staying put', () => {
    const link = { type: 'element' as const, tagName: 'a' };
    const calls: string[] = [];

    plugin.element.visit(link, {
      appendChild: () => calls.push('appendChild'),
      setProperty: () => calls.push('setProperty'),
    });

    expect(calls).toStrictEqual([]);
  });

  test('rejects a site URL that is not a URL', () => {
    expect(() => externalLinkPlugin({ siteUrl: 'example.com' })).toThrow(TypeError);
  });

  test('accepts the site URL as a URL', () => {
    const { element } = externalLinkPlugin({ siteUrl: new URL('http://localhost:4321') });
    const link: ILink = {
      type: 'element',
      tagName: 'a',
      properties: { href: 'http://localhost:4321/a' },
      children: [],
    };
    const calls: string[] = [];

    element.visit(link, {
      appendChild: () => calls.push('appendChild'),
      setProperty: () => calls.push('setProperty'),
    });

    expect(calls).toStrictEqual([]);
  });
});

describe('isExternalHref', () => {
  test('compares origins, so another port or scheme is another site', () => {
    expect(isExternalHref('https://example.com:8443/', 'https://example.com')).toBe(true);
    expect(isExternalHref('http://example.com/', 'https://example.com')).toBe(true);
    expect(isExternalHref('https://example.com/a', 'https://example.com')).toBe(false);
  });
});
