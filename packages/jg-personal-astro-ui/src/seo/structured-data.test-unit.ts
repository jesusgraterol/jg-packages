import { describe, expect, test } from 'vitest';

import { buildStructuredData, serializeStructuredData } from './structured-data.ts';
import type { IStructuredDataSite } from './types.ts';

const SITE: IStructuredDataSite = {
  author: { name: 'Ada Lovelace', url: 'https://ada.example/' },
  language: 'en',
  name: 'jg-example',
  url: 'https://example.dev',
};

describe('buildStructuredData', () => {
  test('describes the home page as the website, with the pages it lists in order', () => {
    expect(
      buildStructuredData({
        canonicalUrl: 'https://example.dev/',
        description: 'The site.',
        listedPages: [
          { name: 'jg-one', path: '/packages/jg-one/' },
          { name: 'jg-two', path: '/packages/jg-two/' },
        ],
        site: SITE,
        title: 'jg-example',
        type: 'website',
      }),
    ).toStrictEqual({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@id': 'https://example.dev/#website',
          '@type': 'WebSite',
          author: { '@type': 'Person', name: 'Ada Lovelace', url: 'https://ada.example/' },
          description: 'The site.',
          inLanguage: 'en',
          name: 'jg-example',
          url: 'https://example.dev/',
        },
        {
          '@id': 'https://example.dev/#pages',
          '@type': 'ItemList',
          itemListElement: [
            {
              '@type': 'ListItem',
              name: 'jg-one',
              position: 1,
              url: 'https://example.dev/packages/jg-one/',
            },
            {
              '@type': 'ListItem',
              name: 'jg-two',
              position: 2,
              url: 'https://example.dev/packages/jg-two/',
            },
          ],
        },
      ],
    });
  });

  test('describes a website without listed pages as a single entity', () => {
    const data = buildStructuredData({
      canonicalUrl: 'https://example.dev/',
      description: 'The site.',
      site: SITE,
      title: 'jg-example',
      type: 'website',
    });

    expect(data['@type']).toBe('WebSite');
    expect(data['@graph']).toBeUndefined();
  });

  test('describes a package page with its breadcrumb and its source code', () => {
    const data = buildStructuredData({
      breadcrumbs: [
        { name: 'jg-example', path: '/' },
        { name: 'jg-one', path: '/packages/jg-one/' },
      ],
      canonicalUrl: 'https://example.dev/packages/jg-one/',
      description: 'One package.',
      site: SITE,
      sourceCode: {
        codeRepository: 'https://github.com/ada/jg-example/tree/main/packages/jg-one',
        license: 'https://github.com/ada/jg-example/blob/main/packages/jg-one/LICENSE',
        name: 'jg-one',
        programmingLanguage: 'TypeScript',
        version: '1.0.0',
      },
      title: 'jg-one | jg-example',
      type: 'webpage',
    });
    const [page, source, breadcrumb] = data['@graph'] as Record<string, unknown>[];

    expect(page).toMatchObject({
      '@type': 'WebPage',
      breadcrumb: { '@id': 'https://example.dev/packages/jg-one/#breadcrumb' },
      isPartOf: { '@id': 'https://example.dev/#website' },
      name: 'jg-one | jg-example',
      url: 'https://example.dev/packages/jg-one/',
    });
    expect(source).toMatchObject({
      '@type': 'SoftwareSourceCode',
      programmingLanguage: 'TypeScript',
      url: 'https://example.dev/packages/jg-one/',
      version: '1.0.0',
    });
    expect(breadcrumb).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { item: 'https://example.dev/', position: 1 },
        { item: 'https://example.dev/packages/jg-one/', position: 2 },
      ],
    });
  });

  test('describes a page without a breadcrumb or source code as a single WebPage', () => {
    const data = buildStructuredData({
      breadcrumbs: [{ name: 'jg-example', path: '/' }],
      canonicalUrl: 'https://example.dev/about/',
      description: 'About.',
      site: SITE,
      title: 'About',
      type: 'webpage',
    });

    expect(data['@type']).toBe('WebPage');
    expect(data['breadcrumb']).toBeUndefined();
  });
});

describe('serializeStructuredData', () => {
  test('escapes every <, so the data cannot close its script element', () => {
    const serialized = serializeStructuredData({ name: '</script><script>alert(1)</script>' });

    expect(serialized).not.toContain('<');
    expect(JSON.parse(serialized)).toStrictEqual({ name: '</script><script>alert(1)</script>' });
  });
});
