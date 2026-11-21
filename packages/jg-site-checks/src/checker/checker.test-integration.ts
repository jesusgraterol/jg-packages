import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  ERRORS,
  verifyStaticSite,
  type IStaticSitePage,
  type IVerifyStaticSiteOptions,
} from '../index.js';

const ORIGIN = 'https://site-fixture.example';
const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const sitemapIndex = (...names: string[]): string =>
  `<sitemapindex xmlns="${SITEMAP_NS}">${names
    .map((name) => `<sitemap><loc>${ORIGIN}/${name}</loc></sitemap>`)
    .join('')}</sitemapindex>`;
const urlset = (...items: { path: string; lastmod?: string }[]): string =>
  `<urlset xmlns="${SITEMAP_NS}">${items
    .map(
      ({ path, lastmod }) =>
        `<url><loc>${ORIGIN}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
    )
    .join('')}</urlset>`;

const html = (canonical: string | null, body: string, noindex = false): string =>
  `<!doctype html><html><head><title>Fixture</title>${canonical === null ? '' : `<link href="${canonical}" rel="canonical">`}${noindex ? '<meta content="noindex, follow" name="robots">' : ''}</head><body>${body}</body></html>`;

let workspace: string;
let artifactRoot: string;
let options: IVerifyStaticSiteOptions;

const writeArtifact = async (file: string, value: string): Promise<void> => {
  const filename = join(artifactRoot, file);
  await mkdir(dirname(filename), { recursive: true });
  await writeFile(filename, value);
};

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'jg-site-fixture-'));
  artifactRoot = join(workspace, 'dist');
  const pages: IStaticSitePage[] = [
    { path: '/', canonicalUrl: `${ORIGIN}/`, indexable: true },
    { path: '/guide/', canonicalUrl: `${ORIGIN}/guide/`, indexable: true },
    { path: '/404.html', canonicalUrl: null, indexable: false },
  ];
  options = {
    artifactRoot,
    origin: ORIGIN,
    pages,
    discovery: { sitemap: '/sitemap-index.xml', robots: '/robots.txt', llms: '/llms.txt' },
  };
  await writeArtifact(
    'index.html',
    html(
      `${ORIGIN}/`,
      [
        '<a href="./guide/#caf%C3%A9">Guide</a>',
        '<a href="/guide/?from=home#caf%C3%A9">Guide with referrer</a>',
        '<a href="https://ignored.example/does-not-exist">External</a>',
        '<a href="mailto:hello@example.com">Email</a>',
        '<a href="/docs.md">Markdown</a>',
      ].join(''),
    ),
  );
  await writeArtifact(
    'guide/index.html',
    html(`${ORIGIN}/guide/`, '<h1 id="caf&eacute;">Guide</h1><a href="../">Home</a>'),
  );
  await writeArtifact('404.html', html(null, '<p>Missing</p>', true));
  await writeArtifact('docs.md', '# Guide\n');
  await writeArtifact('sitemap-index.xml', sitemapIndex('sitemap-0.xml', 'sitemap-1.xml'));
  await writeArtifact('sitemap-0.xml', urlset({ path: '/', lastmod: '2026-11-20' }));
  await writeArtifact('sitemap-1.xml', urlset({ path: '/guide/' }));
  await writeArtifact(
    'robots.txt',
    `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap-index.xml\n`,
  );
  await writeArtifact(
    'llms.txt',
    `# Guide\n\n- [Start](/guide/#caf%C3%A9): Intro\n- [Other](https://external.example/other)\n`,
  );
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

test('verifies localized URLs and links and returns exact linked sitemap entries', async () => {
  expect(await verifyStaticSite(options)).toStrictEqual({
    pages: [
      { ...options.pages[0], file: 'index.html' },
      { ...options.pages[1], file: 'guide/index.html' },
      { ...options.pages[2], file: '404.html' },
    ],
    sitemapEntries: [{ url: `${ORIGIN}/`, lastmod: '2026-11-20' }, { url: `${ORIGIN}/guide/` }],
  });
});

test('supports a direct URL set and a build with no configured discovery files', async () => {
  await writeArtifact('sitemap.xml', urlset({ path: '/' }, { path: '/guide/' }));
  const plain = { artifactRoot, origin: options.origin, pages: options.pages };
  expect(await verifyStaticSite(plain)).not.toHaveProperty('sitemapEntries');
  expect(
    (await verifyStaticSite({ ...plain, discovery: { sitemap: '/sitemap.xml' } })).sitemapEntries,
  ).toStrictEqual([{ url: `${ORIGIN}/` }, { url: `${ORIGIN}/guide/` }]);
});

test.each([
  [
    'duplicate sitemap page',
    'sitemap-1.xml',
    urlset({ path: '/' }),
    'Unexpected or duplicate sitemap page',
  ],
  ['missing sitemap page', 'sitemap-1.xml', urlset(), 'sitemap omits an indexable page'],
  [
    'extra non-indexable page',
    'sitemap-1.xml',
    urlset({ path: '/guide/' }, { path: '/404.html' }),
    'Unexpected or duplicate sitemap page',
  ],
  [
    'missing child sitemap',
    'sitemap-index.xml',
    sitemapIndex('sitemap-9.xml'),
    'Missing sitemap file',
  ],
  [
    'duplicate child sitemap',
    'sitemap-index.xml',
    sitemapIndex('sitemap-0.xml', 'sitemap-0.xml'),
    'Duplicate linked sitemap',
  ],
  ['nested index', 'sitemap-1.xml', sitemapIndex('sitemap-0.xml'), 'must link to URL sets'],
  [
    'foreign child sitemap',
    'sitemap-index.xml',
    `<sitemapindex xmlns="${SITEMAP_NS}"><sitemap><loc>https://external.example/sitemap.xml</loc></sitemap></sitemapindex>`,
    'Expected an exact URL on the site origin',
  ],
  ['XML DTD', 'sitemap-1.xml', '<!DOCTYPE urlset>' + urlset(), 'cannot contain a doctype'],
  [
    'wrong robots sitemap',
    'robots.txt',
    `Sitemap: ${ORIGIN}/sitemap-0.xml\n`,
    'robots.txt does not reference the configured sitemap',
  ],
  ['missing llms target', 'llms.txt', '- [Broken](/absent/)\n', 'Broken local link'],
  [
    'incorrect canonical',
    'guide/index.html',
    html(`${ORIGIN}/wrong/`, '<h1 id="café">Guide</h1>'),
    'Canonical URL differs',
  ],
  [
    'unexpected noindex',
    'guide/index.html',
    html(`${ORIGIN}/guide/`, '<h1 id="café">Guide</h1>', true),
    'Indexability differs',
  ],
  ['unexpected indexability', '404.html', html(null, '<p>Missing</p>'), 'Indexability differs'],
  [
    'missing anchor',
    'guide/index.html',
    html(`${ORIGIN}/guide/`, '<h1 id="other">Guide</h1>'),
    'Broken local fragment',
  ],
  [
    'encoded path escape',
    'index.html',
    html(`${ORIGIN}/`, '<a href="/%2e%2e/guide/">Bad</a>'),
    'unsafe path segment',
  ],
  [
    'literal path escape',
    'index.html',
    html(`${ORIGIN}/`, '<a href="../guide/">Bad</a>'),
    'link escapes the site root',
  ],
  [
    'encoded path separator',
    'index.html',
    html(`${ORIGIN}/`, '<a href="/guide%2Findex.html">Bad</a>'),
    'unsafe path segment',
  ],
])('rejects %s', async (_case, file, value, message) => {
  await writeArtifact(file, value);
  await expectToRejectCode(verifyStaticSite(options), ERRORS.SITE_BUILD_INVALID, message);
});

test.skipIf(process.platform === 'win32')(
  'refuses file and directory links that lead outside the artifact',
  async () => {
    const outside = join(workspace, 'outside');
    await mkdir(outside);
    await writeFile(join(outside, 'index.html'), html(null, '<p>Private</p>'));
    await symlink(join(outside, 'index.html'), join(artifactRoot, 'other.html'));
    await expectToRejectCode(
      verifyStaticSite(options),
      ERRORS.SITE_BUILD_INVALID,
      'unsupported file or link',
    );
    await rm(join(artifactRoot, 'other.html'));
    await symlink(outside, join(artifactRoot, 'other'), 'dir');
    await expectToRejectCode(
      verifyStaticSite(options),
      ERRORS.SITE_BUILD_INVALID,
      'unsupported file or link',
    );
  },
);

test.each([
  ['per-file bytes', { textBytes: 64 }],
  ['total text bytes', { totalTextBytes: 250 }],
  ['entry count', { entries: 3 }],
])('enforces the artifact limit for %s', async (_case, limits) => {
  await expectToRejectCode(verifyStaticSite({ ...options, limits }), ERRORS.SITE_BUILD_INVALID);
});

test.each([
  { origin: 'https://site-fixture.example/other' },
  { discovery: { robots: '/robots.txt' } },
  { discovery: { sitemap: '/sitemap.xml?mode=wrong' } },
  { pages: [{ path: '/%2e%2e/guide/', canonicalUrl: null, indexable: false }] },
  { pages: [{ path: '/guide/', canonicalUrl: null, indexable: true }] },
  { limits: { entries: 0 } },
])('rejects invalid options before reading the artifact: %o', async (invalid) => {
  await expectToRejectCode(
    verifyStaticSite({ ...options, ...invalid, artifactRoot: join(workspace, 'missing') }),
    ERRORS.INVALID_SITE_BUILD_OPTIONS,
  );
});
