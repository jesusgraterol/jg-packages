import { GITHUB_API_ORIGIN, GITHUB_RAW_CONTENT_ORIGIN, LOOPBACK_HOSTNAMES } from './constants.js';
import type {
  IGithubApiUrlOptions,
  IGithubQuery,
  IGithubRawContentLocation,
  IGithubRawContentUrlOptions,
} from './types.js';
import { invalidArgument } from './utilities.js';

/**
 * Reads a base URL: https, or http on a loopback host for a local test server, without
 * credentials, a query, or a fragment, and without its trailing slash.
 * @param value The base URL.
 * @param name The argument it came from.
 * @returns The base URL.
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 */
const readBaseUrl = (value: unknown, name: string): string => {
  let url: URL;
  try {
    url = new URL(String(value));
  } catch {
    throw invalidArgument(name);
  }
  const isAllowedProtocol =
    url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(url.hostname));
  if (
    typeof value !== 'string' ||
    !isAllowedProtocol ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw invalidArgument(name);
  }
  return url.href.replace(/\/+$/, '');
};

/**
 * Encodes one path segment, refusing one that's empty or a dot segment, which a URL would
 * resolve away.
 * @param segment The segment.
 * @param name The argument it came from.
 * @returns The encoded segment.
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 */
const encodeSegment = (segment: unknown, name: string): string => {
  if (typeof segment === 'number' && Number.isSafeInteger(segment) && segment >= 0) {
    return String(segment);
  }
  if (typeof segment !== 'string' || segment === '' || segment === '.' || segment === '..') {
    throw invalidArgument(name);
  }
  return encodeURIComponent(segment);
};

/**
 * Encodes a value whose `/`s separate segments, such as a file's path or a branch like
 * `feature/login`, keeping the `/`s.
 * @param value The value.
 * @param name The argument it came from.
 * @returns The encoded value.
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 */
const encodePath = (value: unknown, name: string): string => {
  if (typeof value !== 'string') {
    throw invalidArgument(name);
  }
  return value
    .split('/')
    .map((segment) => encodeSegment(segment, name))
    .join('/');
};

/**
 * Builds a REST API URL from its path segments, each encoded on its own, so a branch's `/`
 * becomes `%2F` and no value can climb out of the path, plus the query parameters.
 * @param segments The path's segments, such as `['repos', owner, repository, 'branches', branch]`.
 * @param query The query parameters; undefined ones are left out.
 * @param options The API's base URL, for GitHub Enterprise Server or a test server.
 * @returns The URL.
 * @example
 * import { buildGithubApiUrl } from 'jg-github';
 *
 * buildGithubApiUrl(['repos', 'acme', 'app', 'branches', 'feature/login'], { per_page: 100 });
 * // 'https://api.github.com/repos/acme/app/branches/feature%2Flogin?per_page=100'
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 */
export const buildGithubApiUrl = (
  segments: readonly (string | number)[],
  query: IGithubQuery = {},
  { apiOrigin = GITHUB_API_ORIGIN }: IGithubApiUrlOptions = {},
): string => {
  const base = readBaseUrl(apiOrigin, 'apiOrigin');
  if (!Array.isArray(segments) || segments.length === 0) {
    throw invalidArgument('segments');
  }
  const url = new URL(
    `${base}/${segments.map((segment: unknown) => encodeSegment(segment, 'segments')).join('/')}`,
  );
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  }
  return url.href;
};

/**
 * Builds the URL of a file's raw content at a ref, with the owner and the repository encoded as
 * one segment each, and the ref's and the path's `/`s kept.
 * @param location The repository, the ref, and the file's path.
 * @param options The raw content's base URL, for a test server.
 * @returns The URL.
 * @example
 * import { buildGithubRawContentUrl } from 'jg-github';
 *
 * buildGithubRawContentUrl({ owner: 'acme', repository: 'app', ref: 'main', path: 'docs/setup.md' });
 * // 'https://raw.githubusercontent.com/acme/app/main/docs/setup.md'
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 */
export const buildGithubRawContentUrl = (
  { owner, repository, ref, path }: IGithubRawContentLocation,
  { rawContentOrigin = GITHUB_RAW_CONTENT_ORIGIN }: IGithubRawContentUrlOptions = {},
): string =>
  `${readBaseUrl(rawContentOrigin, 'rawContentOrigin')}/${encodeSegment(owner, 'owner')}/${encodeSegment(
    repository,
    'repository',
  )}/${encodePath(ref, 'ref')}/${encodePath(path, 'path')}`;
