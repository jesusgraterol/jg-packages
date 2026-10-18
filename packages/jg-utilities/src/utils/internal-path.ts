// the origin a candidate is resolved against: reserved, so no real site can match it
const INTERNAL_ORIGIN = 'https://internal.invalid';

/**
 * Normalizes a path for comparing it with an excluded path: decoded, lowercase, and without a
 * trailing slash, as a router matches routes.
 * @param path The path.
 * @returns The normalized path.
 */
const normalizePath = (path: string): string => {
  const lowercase = path.toLowerCase();
  return lowercase.length > 1 && lowercase.endsWith('/') ? lowercase.slice(0, -1) : lowercase;
};

/**
 * Checks an untrusted path, such as a `returnTo` parameter after sign-in, and returns it only
 * when it stays on the same site and outside the excluded paths, so a link can't send someone to
 * another site or back into a sign-in loop. It must start with one `/`; a protocol-relative URL,
 * an absolute URL, a backslash, or a path that can't be decoded is rejected. An excluded path
 * matches itself and everything under it, by whole segments, case-insensitively, and after
 * decoding, as a router matches routes.
 * @param candidate The untrusted value.
 * @param excludedPaths Paths it must not lead to, such as `['/sign-in']`.
 * @returns The path, normalized, with its query and fragment, or null when it isn't safe.
 * @example
 * import { resolveSafeInternalPath } from 'jg-utilities';
 *
 * resolveSafeInternalPath('/projects/a?tab=files', ['/sign-in']); // => '/projects/a?tab=files'
 * resolveSafeInternalPath('//evil.example', ['/sign-in']); // => null
 * resolveSafeInternalPath('/sign-in/step', ['/sign-in']); // => null
 * resolveSafeInternalPath('/sign-in-help', ['/sign-in']); // => '/sign-in-help'
 */
export const resolveSafeInternalPath = (
  candidate: unknown,
  excludedPaths: readonly string[] = [],
): string | null => {
  if (
    typeof candidate !== 'string' ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /%5c/i.test(candidate)
  ) {
    return null;
  }
  let url: URL;
  let decodedPath: string;
  try {
    url = new URL(candidate, INTERNAL_ORIGIN);
    decodedPath = normalizePath(decodeURI(url.pathname));
  } catch {
    return null;
  }
  const isExcluded = excludedPaths.some((excludedPath) => {
    const excluded = normalizePath(excludedPath);
    return decodedPath === excluded || decodedPath.startsWith(`${excluded}/`);
  });
  if (url.origin !== INTERNAL_ORIGIN || isExcluded) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
};
