import { extractMessage } from 'jg-exception';

import { decodeSitePath, exactSiteUrl } from '../artifact/index.js';
import { invalidSiteOptions } from '../errors.js';

import type { IStaticSiteLimits, IVerifyStaticSiteOptions } from './types.js';

const DEFAULT_LIMITS: IStaticSiteLimits = {
  entries: 16_384,
  textBytes: 8 * 1024 * 1024,
  totalTextBytes: 128 * 1024 * 1024,
};

const checkPublicPath = (path: string, origin: string): void => {
  decodeSitePath(path);
  const url = new URL(path, origin);
  if (url.pathname !== path || url.origin !== origin || url.search || url.hash)
    throw new Error(
      'Page and discovery paths must be normalized site paths without query or fragment.',
    );
};

/**
 * Validates the caller inventory and discovery paths, then supplies normalized defaults.
 * @param options The caller's site contract.
 * @returns The verified origin and limits.
 */
export const validateOptions = (
  options: IVerifyStaticSiteOptions,
): { origin: string; limits: IStaticSiteLimits } => {
  try {
    const url = new URL(options.origin);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.href !== `${url.origin}/` ||
      options.artifactRoot.trim() === '' ||
      !Array.isArray(options.pages)
    )
      throw new Error('A local artifact root, a site origin and a page inventory are required.');
    const { origin } = url;
    const paths = new Set<string>();
    const indexable = new Set<string>();
    for (const page of options.pages) {
      checkPublicPath(page.path, origin);
      if (paths.has(page.path)) throw new Error('The page inventory contains duplicate paths.');
      paths.add(page.path);
      if (typeof page.indexable !== 'boolean')
        throw new Error('Each page must declare its indexability.');
      if (page.canonicalUrl !== null) exactSiteUrl(page.canonicalUrl, origin);
      if (page.indexable) {
        if (page.canonicalUrl === null || indexable.has(page.canonicalUrl))
          throw new Error('Indexable pages need unique canonical URLs.');
        indexable.add(page.canonicalUrl);
      }
    }
    const { sitemap, robots, llms } = options.discovery ?? {};
    for (const path of [sitemap, robots, llms]) {
      if (path !== undefined) checkPublicPath(path, origin);
    }
    if (robots !== undefined && sitemap === undefined)
      throw new Error('Robots verification needs an expected sitemap path.');
    const limits = { ...DEFAULT_LIMITS, ...options.limits };
    if (!Object.values(limits).every((limit) => Number.isSafeInteger(limit) && limit > 0))
      throw new Error('Artifact read and entry limits must be positive safe integers.');
    return { origin, limits };
  } catch (cause) {
    return invalidSiteOptions(extractMessage(cause));
  }
};
