import { GITHUB_API_VERSION, GITHUB_MEDIA_TYPE } from './constants.js';
import type { IGithubHeadersOptions } from './types.js';
import { invalidArgument, isHeaderValue } from './utilities.js';

/**
 * Builds the headers a request to GitHub's REST API sends: the media type, the token as a bearer
 * credential, the User-Agent GitHub requires, and the API version.
 * @param token The token, such as an installation token or an App JWT.
 * @param options The User-Agent and the API version.
 * @returns The headers, with lowercase names.
 * @example
 * import { createGithubHeaders } from 'jg-github';
 *
 * declare const token: string;
 *
 * const response = await fetch('https://api.github.com/installation/repositories', {
 *   headers: createGithubHeaders(token, { userAgent: 'acme-deploy-bot' }),
 * });
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 */
export const createGithubHeaders = (
  token: string,
  { userAgent, apiVersion = GITHUB_API_VERSION }: IGithubHeadersOptions,
): Record<string, string> => {
  if (!isHeaderValue(token) || token.includes(' ')) {
    throw invalidArgument('token');
  }
  if (!isHeaderValue(userAgent)) {
    throw invalidArgument('userAgent');
  }
  if (!isHeaderValue(apiVersion)) {
    throw invalidArgument('apiVersion');
  }
  return {
    accept: GITHUB_MEDIA_TYPE,
    authorization: `Bearer ${token}`,
    'user-agent': userAgent,
    'x-github-api-version': apiVersion,
  };
};
