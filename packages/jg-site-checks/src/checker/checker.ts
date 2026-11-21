import { getErrorCode } from 'jg-exception';

import { indexArtifact, findArtifactFile, siteLink } from '../artifact/index.js';
import { verifyDiscovery } from '../discovery/index.js';
import { ERRORS, invalidSiteBuild } from '../errors.js';
import { scanHtml, type IHtmlScan } from '../markup/index.js';

import { validateOptions } from './options.js';
import type {
  ICheckedSitePage,
  IStaticSiteVerification,
  IVerifyStaticSiteOptions,
} from './types.js';

/**
 * Verifies a static build against an explicit site inventory. Reads only contained local artifact
 * files, indexing each inspected HTML file once. Checks canonical metadata, robots indexability,
 * links and fragments, and the discovery files the caller supplies.
 * @param options The local artifact, production origin, page inventory and optional read limits.
 * @returns Verified pages and optional sitemap entries in document order.
 * @example
 * import { verifyStaticSite } from 'jg-site-checks';
 *
 * await verifyStaticSite({
 *   artifactRoot: 'dist',
 *   origin: 'https://example.com',
 *   pages: [{ path: '/', canonicalUrl: 'https://example.com/', indexable: true }],
 *   discovery: { sitemap: '/sitemap.xml', robots: '/robots.txt' },
 * });
 * @throws
 * - INVALID_SITE_BUILD_OPTIONS: The site build verification options are invalid.
 * - SITE_BUILD_INVALID: The static site build failed verification.
 */
export const verifyStaticSite = async (
  options: IVerifyStaticSiteOptions,
): Promise<IStaticSiteVerification> => {
  const { origin, limits } = validateOptions(options);
  try {
    const artifact = await indexArtifact(options.artifactRoot, limits);
    const html = new Map<string, IHtmlScan>();
    const inspectHtml = async (file: string): Promise<IHtmlScan> => {
      const parsed = html.get(file);
      if (parsed !== undefined) return parsed;
      const scan = scanHtml(await artifact.readText(file));
      html.set(file, scan);
      return scan;
    };

    const checkLink = async (href: string, from: URL): Promise<void> => {
      const target = siteLink(href, from);
      if (target === undefined) return;
      const file = findArtifactFile(artifact.files, target.pathname);
      if (file === undefined)
        invalidSiteBuild(`Broken local link in ${from.pathname}: ${target.pathname}`);
      if (!file.endsWith('.html') || !target.hash) return;
      const fragment = decodeURIComponent(target.hash.slice(1).split(':~:', 1)[0] ?? '');
      if (
        fragment &&
        fragment.toLowerCase() !== 'top' &&
        !(await inspectHtml(file)).anchors.has(fragment)
      )
        invalidSiteBuild(
          `Broken local fragment in ${from.pathname}: ${target.pathname}${target.hash}`,
        );
    };

    const pages: ICheckedSitePage[] = [];
    const indexable = new Set<string>();
    for (const expected of options.pages) {
      const file = findArtifactFile(artifact.files, expected.path);
      if (file === undefined || !file.endsWith('.html'))
        invalidSiteBuild(`Missing HTML page: ${expected.path}`);
      const page = await inspectHtml(file);
      if (
        expected.canonicalUrl === null
          ? page.canonicalLinks.length !== 0
          : page.canonicalLinks.length !== 1 || page.canonicalLinks[0] !== expected.canonicalUrl
      )
        invalidSiteBuild(`Canonical URL differs from the inventory: ${expected.path}`);
      if (page.noindex === expected.indexable)
        invalidSiteBuild(`Indexability differs from the inventory: ${expected.path}`);
      if (expected.indexable && expected.canonicalUrl !== null)
        indexable.add(expected.canonicalUrl);
      const from = new URL(expected.path, origin);
      for (const href of page.links) await checkLink(href, from);
      pages.push({ ...expected, file });
    }
    const sitemapEntries = await verifyDiscovery(
      artifact,
      origin,
      options.discovery ?? {},
      indexable,
      checkLink,
    );
    return { pages, ...(sitemapEntries === undefined ? {} : { sitemapEntries }) };
  } catch (cause) {
    if (getErrorCode(cause) === ERRORS.SITE_BUILD_INVALID) throw cause;
    return invalidSiteBuild('Unable to inspect the static site artifact', cause);
  }
};
