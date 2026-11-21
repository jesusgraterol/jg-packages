import { SaxesParser } from 'saxes';

import { exactSiteUrl, findArtifactFile, type IArtifactIndex } from '../artifact/index.js';
import type { ISiteSitemapEntry } from '../checker/types.js';
import { invalidSiteBuild } from '../errors.js';

const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9';

type IParsedSitemap = {
  kind: 'sitemapindex' | 'urlset';
  entries: { loc: string; lastmod?: string }[];
};

/**
 * Parses the standard sitemap namespace and direct location/lastmod records without external XML.
 * @param xml One sitemap document.
 * @returns Its root type and parsed records.
 */
const parseSitemap = (xml: string): IParsedSitemap => {
  const parser = new SaxesParser({ xmlns: true });
  let depth = 0;
  let kind: IParsedSitemap['kind'] | undefined;
  let entry: IParsedSitemap['entries'][number] | undefined;
  let field: 'loc' | 'lastmod' | undefined;
  let text = '';
  const entries: IParsedSitemap['entries'] = [];

  parser.on('doctype', () => invalidSiteBuild('Sitemaps cannot contain a doctype.'));
  parser.on('cdata', () => invalidSiteBuild('Sitemaps cannot contain CDATA.'));
  parser.on('opentag', ({ local, uri }) => {
    depth += 1;
    if (uri !== SITEMAP_NAMESPACE) invalidSiteBuild('Unexpected sitemap namespace.');
    if (depth === 1 && (local === 'urlset' || local === 'sitemapindex')) {
      kind = local;
    } else if (depth === 2 && local === (kind === 'urlset' ? 'url' : 'sitemap')) {
      entry = { loc: '' };
    } else if (
      depth === 3 &&
      entry !== undefined &&
      (local === 'loc' || local === 'lastmod') &&
      (local === 'loc' ? entry.loc === '' : entry.lastmod === undefined)
    ) {
      field = local;
      text = '';
    } else {
      invalidSiteBuild('Invalid or duplicate sitemap element.');
    }
  });
  parser.on('text', (chunk) => {
    if (field !== undefined) text += chunk;
    else if (chunk.trim() !== '') invalidSiteBuild('Unexpected text in sitemap.');
  });
  parser.on('closetag', () => {
    if (depth === 3 && entry !== undefined && field !== undefined) {
      const content = text.trim();
      if (!content) invalidSiteBuild('A sitemap field is empty.');
      entry[field] = content;
      field = undefined;
    }
    if (depth === 2) {
      if (!entry?.loc) invalidSiteBuild('A sitemap entry has no location.');
      entries.push(entry);
      entry = undefined;
    }
    depth -= 1;
  });
  parser.write(xml).close();
  if (kind === undefined) invalidSiteBuild('The document has no sitemap root.');
  return { kind, entries };
};

/**
 * Checks a sitemap or an index of local sitemaps against the exact public page inventory.
 * @param artifact The indexed site output.
 * @param indexUrl The configured sitemap URL.
 * @param expected The canonical URLs of the indexable pages.
 * @returns Verified sitemap locations and optional modification dates.
 */
export const verifySitemaps = async (
  artifact: IArtifactIndex,
  indexUrl: URL,
  expected: Set<string>,
): Promise<ISiteSitemapEntry[]> => {
  const seenFiles = new Set<string>();
  const readSitemap = async (location: URL): Promise<IParsedSitemap> => {
    const file = findArtifactFile(artifact.files, location.pathname);
    if (file === undefined) invalidSiteBuild(`Missing sitemap file: ${location.pathname}`);
    if (seenFiles.has(file)) invalidSiteBuild(`Duplicate linked sitemap: ${location.pathname}`);
    seenFiles.add(file);
    return parseSitemap(await artifact.readText(file));
  };

  const candidates: ISiteSitemapEntry[] = [];
  const seenUrls = new Set<string>();
  const compare = (parsed: IParsedSitemap): void => {
    for (const entry of parsed.entries) {
      const { href, pathname } = exactSiteUrl(entry.loc, indexUrl.origin);
      if (!expected.has(href) || seenUrls.has(href))
        invalidSiteBuild(`Unexpected or duplicate sitemap page: ${pathname}`);
      seenUrls.add(href);
      candidates.push({
        url: href,
        ...(entry.lastmod === undefined ? {} : { lastmod: entry.lastmod }),
      });
    }
  };

  const index = await readSitemap(indexUrl);
  if (index.kind === 'urlset') {
    compare(index);
  } else {
    if (index.entries.length === 0) invalidSiteBuild('The sitemap index is empty.');
    for (const { loc } of index.entries) {
      const child = await readSitemap(exactSiteUrl(loc, indexUrl.origin));
      if (child.kind !== 'urlset') invalidSiteBuild('A sitemap index must link to URL sets.');
      compare(child);
    }
  }
  const omitted = [...expected].find((url) => !seenUrls.has(url));
  if (omitted !== undefined) invalidSiteBuild(`The sitemap omits an indexable page: ${omitted}`);
  return candidates;
};
