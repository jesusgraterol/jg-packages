import { resolveSafeInternalPath } from 'jg-utilities';

import { INTERNAL_BASE_URL } from './constants.js';
import type { IRetainedSearchParamRule } from './types.js';

/**
 * Checks whether a value is a plain object, such as router state, and not an array or null.
 * @param value The value.
 * @returns Whether it is.
 */
export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads a candidate href as a URL of the app's own: a safe internal path, not under an excluded
 * one, without its hash, and without a trailing slash, or null when it isn't one, such as a path
 * holding an empty segment.
 * @param candidate The href.
 * @param excludedPaths Paths it must not lead to.
 * @returns The URL, or null.
 */
export const readInternalUrl = (
  candidate: unknown,
  excludedPaths: readonly string[],
): URL | null => {
  const safePath = resolveSafeInternalPath(candidate, excludedPaths);
  if (safePath === null) {
    return null;
  }
  const url = new URL(safePath, INTERNAL_BASE_URL);
  const pathname = url.pathname.replace(/\/$/, '') || '/';
  if (pathname.includes('//')) {
    return null;
  }
  url.pathname = pathname;
  url.hash = '';
  return url;
};

/**
 * Keeps the search parameters a page's rules allow, for the href to return to it: each at most
 * once, valid for its schema, and left out at its default. Every other parameter, such as a search
 * box's private text, is dropped.
 * @param source The page's parameters.
 * @param rules Each kept parameter's schema and default.
 * @returns The kept parameters, or null when one is repeated or isn't valid, so the page isn't
 * offered as a way back.
 * @example
 * import { retainSearchParams } from 'jg-react-router';
 * import { z } from 'zod';
 *
 * const kept = retainSearchParams(new URLSearchParams('status=open&lookup=ada%40example.com'), {
 *   status: { schema: z.enum(['all', 'open']), defaultValue: 'all' },
 * });
 * kept?.toString(); // 'status=open', without the private lookup
 */
export const retainSearchParams = (
  source: URLSearchParams,
  rules: Readonly<Record<string, IRetainedSearchParamRule>>,
): URLSearchParams | null => {
  const kept = new URLSearchParams();
  for (const [key, { schema, defaultValue }] of Object.entries(rules)) {
    const values = source.getAll(key);
    if (values.length > 1) {
      return null;
    }
    const [value] = values;
    if (value === undefined) {
      continue;
    }
    try {
      schema?.parse(value);
    } catch {
      return null;
    }
    if (value !== defaultValue) {
      kept.set(key, value);
    }
  }
  return kept;
};
