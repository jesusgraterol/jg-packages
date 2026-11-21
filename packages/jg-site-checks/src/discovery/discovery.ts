import { exactSiteUrl, findArtifactFile, type IArtifactIndex } from '../artifact/index.js';
import { invalidSiteBuild } from '../errors.js';

import { verifySitemaps } from './sitemap.js';

import type { ISiteSitemapEntry, IStaticSiteDiscovery } from '../checker/types.js';

/**
 * Verifies configured crawl and discovery files offline.
 * @param artifact The indexed site output.
 * @param origin The configured public site origin.
 * @param discovery Optional site-relative paths to the generated discovery files.
 * @param expected The canonical URLs of the indexable pages.
 * @param checkLink A caller's checked-link function with access to the anchor index.
 * @returns Verified entries when a sitemap is configured.
 */
export const verifyDiscovery = async (
  artifact: IArtifactIndex,
  origin: string,
  discovery: IStaticSiteDiscovery,
  expected: Set<string>,
  checkLink: (href: string, from: URL) => Promise<void>,
): Promise<ISiteSitemapEntry[] | undefined> => {
  const read = async (location: URL): Promise<string> => {
    const file = findArtifactFile(artifact.files, location.pathname);
    if (file === undefined) invalidSiteBuild(`Missing discovery file: ${location.pathname}`);
    return artifact.readText(file);
  };
  const sitemap = discovery.sitemap === undefined ? undefined : new URL(discovery.sitemap, origin);
  if (discovery.robots !== undefined) {
    const location = new URL(discovery.robots, origin);
    const references = (await read(location)).split(/\r?\n/u).flatMap((line) => {
      const match = /^\s*sitemap\s*:\s*([^\s#]+)\s*(?:#.*)?$/iu.exec(line);
      return match?.[1] === undefined ? [] : [match[1]];
    });
    if (
      sitemap === undefined ||
      !references.includes(sitemap.href) ||
      references.some((reference) => {
        const target = exactSiteUrl(reference, origin);
        return findArtifactFile(artifact.files, target.pathname) === undefined;
      })
    )
      invalidSiteBuild(
        'robots.txt does not reference the configured sitemap with an exact site URL.',
      );
  }
  if (discovery.llms !== undefined) {
    const location = new URL(discovery.llms, origin);
    const file = await read(location);
    for (const match of file.matchAll(/(?<!!)\[[^\n]*?\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/gu)) {
      const href = match[1] ?? match[2];
      if (href !== undefined) await checkLink(href, location);
    }
  }
  return sitemap === undefined ? undefined : verifySitemaps(artifact, sitemap, expected);
};
