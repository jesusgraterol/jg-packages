// archive and backup directories cannot be traversed or used as build destinations
export const EXCLUDED_DIRECTORIES = new Set(['_archive', '_archives', '_backup', '_backups']);

const UNSAFE_SEGMENT = /[\\/:<>|?*\p{Cc}]/u;

/**
 * Decodes each path component without permitting escaped separators or reserved project paths.
 * @param pathname The URL pathname.
 * @returns The decoded path with its trailing slash preserved.
 */
export const decodeSitePath = (pathname: string): string => {
  if (!pathname.startsWith('/') || pathname.startsWith('//'))
    throw new Error('Expected one absolute site path.');
  const parts = pathname.split('/');
  for (let index = 1; index < parts.length; index += 1) {
    const part = decodeURIComponent(parts[index] ?? '');
    if (
      (part === '' && index < parts.length - 1) ||
      part === '.' ||
      part === '..' ||
      UNSAFE_SEGMENT.test(part) ||
      EXCLUDED_DIRECTORIES.has(part)
    )
      throw new Error('The URL contains an unsafe path segment.');
    parts[index] = part;
  }
  return parts.join('/');
};

/**
 * Finds the built file serving a decoded site URL path.
 * @param files File names in the artifact, relative to its root.
 * @param pathname A URL pathname.
 * @returns Its relative file, if present.
 */
export const findArtifactFile = (files: Set<string>, pathname: string): string | undefined => {
  const decoded = decodeSitePath(pathname).slice(1);
  if (decoded === '' || decoded.endsWith('/')) {
    const index = `${decoded}index.html`;
    return files.has(index) ? index : undefined;
  }
  return [decoded, `${decoded}/index.html`, `${decoded}.html`].find((file) => files.has(file));
};

/**
 * Rejects path spellings the URL parser can otherwise normalize before verification.
 * @param href The original trimmed link.
 * @param from The referring page's URL.
 */
const assertLinkPath = (href: string, from: URL): void => {
  if (href.includes('\\')) throw new Error('Backslashes are invalid in a site link.');
  const rawPath = href.split(/[?#]/u, 1)[0] ?? '';
  const path = rawPath.replace(/^(?:https?:)?\/\/[^/]*/iu, '');
  if (!path) return;

  let depth = path.startsWith('/') ? 0 : from.pathname.split('/').length - 2;
  for (const part of path.split('/')) {
    const decoded = decodeURIComponent(part);
    if (
      UNSAFE_SEGMENT.test(decoded) ||
      EXCLUDED_DIRECTORIES.has(decoded) ||
      ((decoded === '.' || decoded === '..') && decoded !== part)
    )
      throw new Error('The link contains an unsafe path segment.');
    if (decoded === '..') {
      if (depth === 0) throw new Error('The link escapes the site root.');
      depth -= 1;
    } else if (decoded !== '' && decoded !== '.') {
      depth += 1;
    }
  }
};

/**
 * Resolves a link against its page, skipping destinations outside the configured origin.
 * @param href The document link.
 * @param from The referring URL, already on the configured origin.
 * @returns The validated same-origin URL, if applicable.
 */
export const siteLink = (href: string, from: URL): URL | undefined => {
  const source = href.trim();
  const target = new URL(source, from);
  if (target.origin !== from.origin || !['https:', 'http:'].includes(target.protocol))
    return undefined;
  if (target.username || target.password)
    throw new Error('Credentials are invalid in a site link.');
  assertLinkPath(source, from);
  decodeSitePath(target.pathname);
  return target;
};

/**
 * Requires an exact literal canonical URL on the expected origin.
 * @param value The sitemap or canonical URL.
 * @param origin The canonical origin.
 * @returns The URL after syntax and path validation.
 */
export const exactSiteUrl = (value: string, origin: string): URL => {
  const url = new URL(value);
  if (
    url.href !== value ||
    url.origin !== origin ||
    value.includes('?') ||
    value.includes('#') ||
    url.username ||
    url.password
  )
    throw new Error('Expected an exact URL on the site origin.');
  assertLinkPath(value, url);
  decodeSitePath(url.pathname);
  return url;
};
