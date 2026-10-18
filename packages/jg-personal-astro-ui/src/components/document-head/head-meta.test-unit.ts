import { describe, expect, test } from 'vitest';

import { buildHeadTags, type IHeadTag, type IHeadTagsOptions } from './head-meta.ts';

// a page with everything a site usually sets
const PAGE: IHeadTagsOptions = {
  canonicalUrl: 'https://example.com/guide/',
  description: 'How the guide works.',
  llmsTextUrl: 'https://example.com/llms.txt',
  locale: 'en_US',
  noIndex: false,
  openGraphImage: {
    alt: 'The guide',
    height: 630,
    type: 'image/png',
    url: 'https://example.com/og.png',
    width: 1200,
  },
  openGraphType: 'website',
  siteName: 'Example',
  title: 'Guide | Example',
  twitterCreator: '@example',
};

/**
 * Lists the tags as `element key=value …` lines, so a whole head reads like markup.
 * @param tags The tags.
 * @returns One line per tag, attributes in render order.
 */
const describeTags = (tags: IHeadTag[]): string[] =>
  tags.map(
    ({ attributes, element }) =>
      `${element} ${Object.entries(attributes)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ')}`,
  );

/**
 * Finds the content of a meta tag.
 * @param tags The tags.
 * @param property Its property or name.
 * @returns The content, or undefined when there is no such tag.
 */
const contentOf = (tags: IHeadTag[], property: string): string | undefined =>
  tags.find(
    ({ attributes }) => attributes['property'] === property || attributes['name'] === property,
  )?.attributes['content'];

describe('buildHeadTags', () => {
  test('renders a website page as before: links, then Open Graph, then the X card', () => {
    expect(describeTags(buildHeadTags(PAGE))).toStrictEqual([
      'link rel=canonical href=https://example.com/guide/',
      'link rel=describedby href=https://example.com/llms.txt',
      'meta property=og:site_name content=Example',
      'meta property=og:locale content=en_US',
      'meta property=og:type content=website',
      'meta property=og:title content=Guide | Example',
      'meta property=og:description content=How the guide works.',
      'meta property=og:url content=https://example.com/guide/',
      'meta property=og:image content=https://example.com/og.png',
      'meta property=og:image:type content=image/png',
      'meta property=og:image:width content=1200',
      'meta property=og:image:height content=630',
      'meta property=og:image:alt content=The guide',
      'meta name=twitter:card content=summary_large_image',
      'meta name=twitter:creator content=@example',
      'meta name=twitter:title content=Guide | Example',
      'meta name=twitter:description content=How the guide works.',
      'meta name=twitter:image content=https://example.com/og.png',
      'meta name=twitter:image:alt content=The guide',
    ]);
  });

  test('leaves out the links it has no URL for', () => {
    const tags = describeTags(
      buildHeadTags({ ...PAGE, canonicalUrl: undefined, llmsTextUrl: undefined }),
    );

    expect(tags.filter((tag) => tag.startsWith('link'))).toStrictEqual([]);
    expect(tags.some((tag) => tag.includes('og:url'))).toBe(false);
  });

  test('leaves the canonical URL and og:url off a noindex page', () => {
    const tags = describeTags(buildHeadTags({ ...PAGE, noIndex: true }));

    expect(tags.some((tag) => tag.includes('canonical') || tag.includes('og:url'))).toBe(false);
  });

  test('uses the summary card, and no image tags, without an image', () => {
    const tags = buildHeadTags({ ...PAGE, openGraphImage: undefined, twitterCreator: undefined });

    expect(contentOf(tags, 'twitter:card')).toBe('summary');
    expect(describeTags(tags).filter((tag) => tag.includes('image'))).toStrictEqual([]);
    expect(contentOf(tags, 'twitter:creator')).toBeUndefined();
  });

  test.each([
    [
      { href: '/guide.md', type: 'text/markdown' },
      'link rel=alternate type=text/markdown href=/guide.md',
    ],
    [
      { href: '/prompt.txt', title: 'The prompt as plain text', type: 'text/plain' },
      'link rel=alternate type=text/plain href=/prompt.txt title=The prompt as plain text',
    ],
  ])('renders the alternate %o', (alternate, expected) => {
    expect(describeTags(buildHeadTags({ ...PAGE, alternate }))).toContain(expected);
  });

  test('renders each icon, in order, with only the attributes it has', () => {
    const tags = describeTags(
      buildHeadTags({
        ...PAGE,
        icons: [
          { href: '/favicon.ico', rel: 'icon', sizes: '16x16 32x32 48x48' },
          { href: '/favicons/32x32.png', rel: 'icon', sizes: '32x32', type: 'image/png' },
          { href: '/favicon.svg', rel: 'icon', type: 'image/svg+xml' },
          { href: '/favicons/192x192.png', rel: 'apple-touch-icon' },
        ],
      }),
    ).filter((tag) => tag.includes('icon'));

    expect(tags).toStrictEqual([
      'link rel=icon sizes=16x16 32x32 48x48 href=/favicon.ico',
      'link rel=icon type=image/png sizes=32x32 href=/favicons/32x32.png',
      'link rel=icon type=image/svg+xml href=/favicon.svg',
      'link rel=apple-touch-icon href=/favicons/192x192.png',
    ]);
  });

  test('renders an article page with its article:* tags after the image', () => {
    const tags = buildHeadTags({
      ...PAGE,
      article: {
        author: 'Jesus Graterol',
        modifiedTime: '2026-10-18T00:00:00.000Z',
        publishedTime: '2026-10-01T00:00:00.000Z',
        section: 'Cookbook',
      },
      openGraphType: 'article',
    });

    expect(contentOf(tags, 'og:type')).toBe('article');
    expect(describeTags(tags).slice(13, 17)).toStrictEqual([
      'meta property=article:published_time content=2026-10-01T00:00:00.000Z',
      'meta property=article:modified_time content=2026-10-18T00:00:00.000Z',
      'meta property=article:author content=Jesus Graterol',
      'meta property=article:section content=Cookbook',
    ]);
  });

  test('renders only the article details it has', () => {
    const tags = describeTags(
      buildHeadTags({ ...PAGE, article: { author: 'Ada' }, openGraphType: 'article' }),
    ).filter((tag) => tag.includes('article:'));

    expect(tags).toStrictEqual(['meta property=article:author content=Ada']);
  });

  test.each([
    ['for an article page without its details', { openGraphType: 'article' as const }],
    [
      'when article details come with another type',
      { article: { author: 'Ada' }, openGraphType: 'website' as const },
    ],
    [
      'for an article page given profile details',
      { openGraphType: 'article' as const, profile: { firstName: 'Ada', lastName: 'L' } },
    ],
  ])('renders no article or profile tags %s', (_, options) => {
    const tags = describeTags(buildHeadTags({ ...PAGE, ...options }));

    expect(tags.filter((tag) => /article:|profile:/u.test(tag))).toStrictEqual([]);
  });

  test('renders a profile page with its profile:* tags', () => {
    const tags = buildHeadTags({
      ...PAGE,
      openGraphType: 'profile',
      profile: { firstName: 'Jesus', lastName: 'Graterol', username: 'jesusgraterol' },
    });

    expect(contentOf(tags, 'og:type')).toBe('profile');
    expect(describeTags(tags).filter((tag) => tag.includes('profile:'))).toStrictEqual([
      'meta property=profile:first_name content=Jesus',
      'meta property=profile:last_name content=Graterol',
      'meta property=profile:username content=jesusgraterol',
    ]);
  });

  test('leaves the username off a profile without one, and profile details off other types', () => {
    const profile = { firstName: 'Ada', lastName: 'Lovelace' };

    expect(
      describeTags(buildHeadTags({ ...PAGE, openGraphType: 'profile', profile })).filter((tag) =>
        tag.includes('profile:'),
      ),
    ).toStrictEqual([
      'meta property=profile:first_name content=Ada',
      'meta property=profile:last_name content=Lovelace',
    ]);
    expect(
      describeTags(buildHeadTags({ ...PAGE, profile })).filter((tag) => tag.includes('profile:')),
    ).toStrictEqual([]);
  });
});
