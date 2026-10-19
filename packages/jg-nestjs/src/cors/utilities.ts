import { WWW_PREFIX } from './constants.js';

/**
 * Builds the two origins of a URL, with and without the `www.` hostname prefix, keeping its scheme
 * and port.
 * @param url The URL, such as `https://example.com`.
 * @returns The origins, such as `https://example.com` and `https://www.example.com`.
 */
export const buildCorsOriginVariants = (url: string): string[] => {
  const { origin, hostname } = new URL(url);
  const bareHostname = hostname.startsWith(WWW_PREFIX)
    ? hostname.slice(WWW_PREFIX.length)
    : hostname;
  return [bareHostname, `${WWW_PREFIX}${bareHostname}`].map((variant) => {
    const variantUrl = new URL(origin);
    variantUrl.hostname = variant;
    return variantUrl.origin;
  });
};

/**
 * Builds the set of origins a request's Origin header must match exactly.
 * @param origins The configured origins.
 * @param includeWwwVariants Whether each also allows its `www.` variant.
 * @returns The allowed origins, normalized as browsers send them.
 */
export const buildAllowedOrigins = (
  origins: readonly string[],
  includeWwwVariants: boolean,
): Set<string> =>
  new Set(
    origins.flatMap((origin) =>
      includeWwwVariants ? buildCorsOriginVariants(origin) : [new URL(origin).origin],
    ),
  );
