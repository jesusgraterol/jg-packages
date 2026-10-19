import { request } from 'jg-fetch';

import { createGithubAppJwt } from '../app-auth/index.js';
import {
  DEFAULT_GITHUB_MAX_RESPONSE_BYTES,
  DEFAULT_GITHUB_TIMEOUT_SECONDS,
  buildGithubApiUrl,
  createGithubHeaders,
} from '../shared/index.js';
import { INVALID_ARGUMENT_KINDS } from './constants.js';
import {
  fromFetchError,
  responseInvalid,
  revokeFailed,
  scopeMismatch,
  tokenExpired,
} from './errors.js';
import type {
  ICreateInstallationTokenOptions,
  IGithubRequestOptions,
  IInstallationToken,
} from './types.js';
import { findScopeMismatch, readToken, readTokenDetails } from './utilities.js';
import { readInstallationId, readPermissions, readRequestedRepositories } from './validations.js';

/**
 * Revokes an installation token before it expires, such as when the work it was for is done,
 * with `DELETE /installation/token`, which GitHub answers with 204. It never retries. The error
 * never holds the token.
 * @param token The installation token.
 * @param options The User-Agent, the API's base URL and version, and the limits.
 * @returns A promise that resolves once GitHub has revoked it.
 * @example
 * import { revokeInstallationToken } from 'jg-github';
 *
 * declare const token: string;
 *
 * await revokeInstallationToken(token, { userAgent: 'acme-deploy-bot' });
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 * - GITHUB_TOKEN_REVOKE_FAILED: The installation token couldn't be revoked.
 */
export const revokeInstallationToken = async (
  token: string,
  {
    userAgent,
    apiOrigin,
    apiVersion,
    timeoutSeconds = DEFAULT_GITHUB_TIMEOUT_SECONDS,
    signal,
  }: IGithubRequestOptions,
): Promise<void> => {
  const headers = createGithubHeaders(token, { userAgent, apiVersion });
  const { error, meta } = await request(
    buildGithubApiUrl(['installation', 'token'], {}, { apiOrigin }),
    {
      method: 'DELETE',
      headers,
      parseAs: 'none',
      retryDelaysSeconds: [],
      timeoutSeconds,
      init: { redirect: 'error' },
      ...(signal === undefined ? {} : { signal }),
    },
  );
  if (error !== null) {
    throw INVALID_ARGUMENT_KINDS.has(error.kind)
      ? fromFetchError(error, [token])
      : revokeFailed(error.kind, error.status, [token]);
  }
  if (meta.status !== 204) {
    throw revokeFailed('UNEXPECTED_STATUS', meta.status, [token]);
  }
};

/**
 * Revokes a token jg-github received but won't hand over, with its own timeout and without the
 * caller's signal, so a cancelled call still revokes it.
 * @param token The token.
 * @param options The request's options.
 * @returns A promise that resolves to whether GitHub revoked it.
 */
const revokeUnusedToken = async (
  token: string,
  { userAgent, apiOrigin, apiVersion, timeoutSeconds }: IGithubRequestOptions,
): Promise<boolean> => {
  try {
    await revokeInstallationToken(token, { userAgent, apiOrigin, apiVersion, timeoutSeconds });
    return true;
  } catch {
    return false;
  }
};

/**
 * Creates an installation token for exactly the repositories and the permissions asked for, with
 * `POST /app/installations/{id}/access_tokens`, authenticated as the App. `permissions` is
 * required, because GitHub grants every permission of the installation without it, and the
 * repositories are named by name or by ID, never both. The granted token must reach exactly
 * those repositories, only the selected ones, with exactly those permissions, plus
 * `metadata: 'read'`, and must not have expired; otherwise it's revoked before the error is
 * thrown, and the error's data says whether that worked. Nothing is retried, and no error holds
 * the token or the App's JWT.
 * @param options The App, the installation, the scope, and the request's limits.
 * @returns A promise that resolves to the token, when it expires, and what it reaches.
 * @example
 * import { createInstallationToken, revokeInstallationToken } from 'jg-github';
 *
 * declare const privateKey: string;
 *
 * const { token } = await createInstallationToken({
 *   appId: 123456,
 *   privateKey,
 *   installationId: 12345678,
 *   repositories: ['app'],
 *   permissions: { contents: 'read' },
 *   userAgent: 'acme-deploy-bot',
 * });
 * try {
 *   // read the repository's contents with the token
 * } finally {
 *   await revokeInstallationToken(token, { userAgent: 'acme-deploy-bot' });
 * }
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 * - GITHUB_PRIVATE_KEY_INVALID: The GitHub App's private key isn't an unencrypted RSA private key.
 * - GITHUB_REQUEST_FAILED: The GitHub request failed.
 * - GITHUB_RESPONSE_INVALID: GitHub's response isn't in the expected format.
 * - GITHUB_TOKEN_SCOPE_MISMATCH: The installation token's scope isn't the one requested.
 * - GITHUB_TOKEN_EXPIRED: The installation token had already expired.
 */
export const createInstallationToken = async (
  options: ICreateInstallationTokenOptions,
): Promise<IInstallationToken> => {
  const {
    appId,
    privateKey,
    installationId,
    permissions,
    repositories,
    repositoryIds,
    userAgent,
    apiOrigin,
    apiVersion,
    timeoutSeconds = DEFAULT_GITHUB_TIMEOUT_SECONDS,
    maxResponseBytes = DEFAULT_GITHUB_MAX_RESPONSE_BYTES,
    signal,
  } = options;
  const id = readInstallationId(installationId);
  const requestedPermissions = readPermissions(permissions);
  const requested = readRequestedRepositories(repositories, repositoryIds);
  const url = buildGithubApiUrl(['app', 'installations', id, 'access_tokens'], {}, { apiOrigin });
  const jwt = createGithubAppJwt({ appId, privateKey });
  const { data, error, meta } = await request(url, {
    method: 'POST',
    headers: createGithubHeaders(jwt, { userAgent, apiVersion }),
    body: {
      permissions: requestedPermissions,
      ...(requested.kind === 'names'
        ? { repositories: requested.values }
        : { repository_ids: requested.values }),
    },
    parseAs: 'json',
    retryDelaysSeconds: [],
    timeoutSeconds,
    maxResponseBytes,
    init: { redirect: 'error' },
    ...(signal === undefined ? {} : { signal }),
  });
  if (error !== null) {
    throw fromFetchError(error, [jwt]);
  }
  const token = readToken(data);
  if (token === undefined) {
    throw responseInvalid([jwt]);
  }

  // from here on GitHub granted a token, which is revoked before any error is thrown
  const redact = [jwt, token];
  const revokeOptions = { userAgent, apiOrigin, apiVersion, timeoutSeconds };
  const details = meta.status === 201 ? readTokenDetails(data) : undefined;
  if (details === undefined) {
    throw responseInvalid(redact, await revokeUnusedToken(token, revokeOptions));
  }
  const mismatch = findScopeMismatch(details, requested, requestedPermissions);
  if (mismatch !== null) {
    throw scopeMismatch(mismatch, await revokeUnusedToken(token, revokeOptions), redact);
  }
  if (details.expiresAt.getTime() <= Date.now()) {
    throw tokenExpired(await revokeUnusedToken(token, revokeOptions), redact);
  }
  return {
    token,
    expiresAt: details.expiresAt,
    permissions: details.permissions,
    repositories: details.repositories.map(({ id: repositoryId, fullName }) => ({
      id: repositoryId,
      fullName,
    })),
  };
};
