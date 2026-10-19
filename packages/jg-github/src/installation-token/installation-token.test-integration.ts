// @vitest-environment node
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';

import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { GITHUB_API_VERSION } from '../shared/constants.js';
import { ERRORS } from '../shared/index.js';
import { catchRejection, expectNoValue } from '../shared/leak.test-utils.js';
import { type ITestServer, sendJson, startTestServer } from '../shared/server.test-utils.js';

import { createInstallationToken, revokeInstallationToken } from './installation-token.js';
import type { ICreateInstallationTokenOptions } from './types.js';

// the token the test server grants, which no error may show
const TOKEN = 'ghs_16C7e42F292c6912E7710c838347Ae178B4a';
const TOKEN_PATH = '/app/installations/42/access_tokens';
const REVOKE_PATH = '/installation/token';
const USER_AGENT = 'jg-github-tests';

// the repositories the test installation holds
const APP = { id: 101, name: 'app', full_name: 'acme/app' };
const DOCS = { id: 102, name: 'docs', full_name: 'acme/docs' };
const INFRA = { id: 103, name: 'infra', full_name: 'acme/infra' };

/**
 * Builds the answer GitHub gives to a token request.
 * @param overrides The fields to replace.
 * @returns The answer.
 */
const buildTokenResponse = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  token: TOKEN,
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  permissions: { contents: 'read', metadata: 'read' },
  repository_selection: 'selected',
  repositories: [APP, DOCS],
  ...overrides,
});

/**
 * Reads the JSON body a request sent.
 * @param server The test server.
 * @param path The request's path.
 * @returns The body.
 */
const readRequestBody = (server: ITestServer, path: string): unknown =>
  JSON.parse(server.requests(path)[0]?.body ?? 'null');

describe('installation tokens', () => {
  let server: ITestServer;
  let privateKey: string;
  let options: ICreateInstallationTokenOptions;

  beforeAll(async () => {
    server = await startTestServer();
    // a key generated for these tests, never committed
    privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs1', format: 'pem' })
      .toString();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    server.reset();
    server.route(REVOKE_PATH, (_request, response) => {
      response.writeHead(204).end();
    });
    options = {
      appId: 123456,
      privateKey,
      installationId: 42,
      repositories: ['app', 'docs'],
      permissions: { contents: 'read' },
      userAgent: USER_AGENT,
      apiOrigin: server.origin,
    };
  });

  /**
   * Answers the token request with a status and a body.
   * @param body The answer.
   * @param status The status. Defaults to 201
   */
  const answerTokenRequest = (body: unknown, status = 201): void => {
    server.route(TOKEN_PATH, (_request, response) => {
      sendJson(response, status, body);
    });
  };

  /**
   * Asserts that no error shows the token or the App's JWT.
   * @param error The error.
   */
  const expectNoCredentials = (error: unknown): void => {
    expectNoValue(error, TOKEN);
    const jwt = server.requests(TOKEN_PATH)[0]?.headers.authorization?.slice('Bearer '.length);
    if (jwt !== undefined) {
      expectNoValue(error, jwt);
    }
  };

  describe('a token for exactly the requested scope', () => {
    test('authenticates as the App with a JWT the public key verifies, and sends the scope', async () => {
      answerTokenRequest(buildTokenResponse());

      await createInstallationToken(options);

      const [tokenRequest] = server.requests(TOKEN_PATH);
      expect(tokenRequest?.method).toBe('POST');
      expect(tokenRequest?.headers).toMatchObject({
        accept: 'application/vnd.github+json',
        'user-agent': USER_AGENT,
        'x-github-api-version': GITHUB_API_VERSION,
        'content-type': 'application/json',
      });
      const [header, payload, signature] = (tokenRequest?.headers.authorization ?? '')
        .slice('Bearer '.length)
        .split('.');
      expect(
        verify(
          'RSA-SHA256',
          Buffer.from(`${header}.${payload}`),
          createPublicKey(privateKey),
          Buffer.from(signature ?? '', 'base64url'),
        ),
      ).toBe(true);
      expect(JSON.parse(Buffer.from(payload ?? '', 'base64url').toString())).toMatchObject({
        iss: '123456',
      });
      expect(readRequestBody(server, TOKEN_PATH)).toStrictEqual({
        permissions: { contents: 'read' },
        repositories: ['app', 'docs'],
      });
      expect(server.requests(REVOKE_PATH)).toHaveLength(0);
    });

    test('gives the token for two repositories requested by name, ignoring case', async () => {
      answerTokenRequest(buildTokenResponse());

      const token = await createInstallationToken({
        ...options,
        repositories: ['App', 'DOCS'],
      } as ICreateInstallationTokenOptions);

      expect(token).toStrictEqual({
        token: TOKEN,
        expiresAt: expect.any(Date) as Date,
        permissions: { contents: 'read', metadata: 'read' },
        repositories: [
          { id: 101, fullName: 'acme/app' },
          { id: 102, fullName: 'acme/docs' },
        ],
      });
    });

    test('gives the token for two repositories requested by ID', async () => {
      answerTokenRequest(buildTokenResponse({ repositories: [DOCS, APP] }));

      const { repositories } = await createInstallationToken({
        ...options,
        repositories: undefined,
        repositoryIds: [101, 102],
      });

      expect(readRequestBody(server, TOKEN_PATH)).toStrictEqual({
        permissions: { contents: 'read' },
        repository_ids: [101, 102],
      });
      expect(repositories.map(({ id }) => id)).toStrictEqual([102, 101]);
    });
  });

  describe('a token whose scope differs, which is revoked', () => {
    test.each([
      ['a missing repository', { repositories: [APP] }, 'repositories'],
      ['an extra repository', { repositories: [APP, DOCS, INFRA] }, 'repositories'],
      [
        'every repository of the installation',
        { repository_selection: 'all', repositories: undefined },
        'repository_selection',
      ],
      [
        'a higher permission',
        { permissions: { contents: 'write', metadata: 'read' } },
        'permissions',
      ],
      [
        'an extra permission',
        { permissions: { contents: 'read', administration: 'write' } },
        'permissions',
      ],
    ])('refuses %s', async (_description, overrides, mismatch) => {
      answerTokenRequest(buildTokenResponse(overrides));

      const error = await catchRejection(createInstallationToken(options));

      expect(error).toMatchObject({
        code: ERRORS.GITHUB_TOKEN_SCOPE_MISMATCH,
        data: { mismatch, isRevoked: true },
      });
      expect(server.requests(REVOKE_PATH)).toHaveLength(1);
      expect(server.requests(REVOKE_PATH)[0]?.method).toBe('DELETE');
      expect(server.requests(REVOKE_PATH)[0]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
      expectNoCredentials(error);
    });

    test('says so when the revocation fails too', async () => {
      answerTokenRequest(buildTokenResponse({ repositories: [APP] }));
      server.route(REVOKE_PATH, (_request, response) => {
        sendJson(response, 500, { message: `revocation failed for ${TOKEN}` });
      });

      const error = await catchRejection(createInstallationToken(options));

      expect(error).toMatchObject({
        code: ERRORS.GITHUB_TOKEN_SCOPE_MISMATCH,
        data: { mismatch: 'repositories', isRevoked: false },
      });
      expectNoCredentials(error);
    });

    test('revokes a token that had already expired', async () => {
      answerTokenRequest(
        buildTokenResponse({ expires_at: new Date(Date.now() - 1000).toISOString() }),
      );

      const error = await catchRejection(createInstallationToken(options));

      expect(error).toMatchObject({ code: ERRORS.GITHUB_TOKEN_EXPIRED, data: { isRevoked: true } });
      expect(server.requests(REVOKE_PATH)).toHaveLength(1);
      expectNoCredentials(error);
    });

    test.each([
      ['malformed details', buildTokenResponse({ permissions: 'contents' }), 201],
      ['a status other than 201', buildTokenResponse(), 200],
    ])('revokes a token whose answer has %s', async (_description, body, status) => {
      answerTokenRequest(body, status);

      const error = await catchRejection(createInstallationToken(options));

      expect(error).toMatchObject({
        code: ERRORS.GITHUB_RESPONSE_INVALID,
        data: { isRevoked: true },
      });
      expect(server.requests(REVOKE_PATH)).toHaveLength(1);
      expectNoCredentials(error);
    });

    test('revokes nothing when the answer holds no token', async () => {
      answerTokenRequest(buildTokenResponse({ token: undefined }));

      const error = await catchRejection(createInstallationToken(options));

      expect(error).toMatchObject({ code: ERRORS.GITHUB_RESPONSE_INVALID });
      expect((error as { data?: unknown }).data).toBeUndefined();
      expect(server.requests(REVOKE_PATH)).toHaveLength(0);
    });
  });

  describe('a request refused before it is sent', () => {
    test.each([
      ['no permissions', { permissions: undefined }],
      ['empty permissions', { permissions: {} }],
      ['an unknown permission level', { permissions: { contents: 'owner' } }],
      ['a permission name with capitals', { permissions: { Contents: 'read' } }],
      ['no repositories', { repositories: [] }],
      ['a repository named twice', { repositories: ['app', 'App'] }],
      ['a repository name with a slash', { repositories: ['acme/app'] }],
      ['repositories by name and by ID', { repositoryIds: [101] }],
      ['neither names nor IDs', { repositories: undefined }],
      ['no repository IDs', { repositories: undefined, repositoryIds: [] }],
      ['a repository ID given twice', { repositories: undefined, repositoryIds: [101, 101] }],
      ['a repository ID of 0', { repositories: undefined, repositoryIds: [0] }],
      ['an installation ID of 0', { installationId: 0 }],
      ['an installation ID that is not digits', { installationId: '42/../../user' }],
      ['an API on plain http elsewhere', { apiOrigin: 'http://github.example.com' }],
      ['an empty User-Agent', { userAgent: '' }],
      ['an app ID of 0', { appId: 0 }],
      ['a timeout of 0', { timeoutSeconds: 0 }],
    ])('refuses %s, sending nothing', async (_description, overrides) => {
      await expectToRejectCode(
        createInstallationToken({ ...options, ...overrides } as ICreateInstallationTokenOptions),
        ERRORS.GITHUB_INVALID_ARGUMENT,
      );
      expect(server.requestCount()).toBe(0);
    });

    test('refuses a private key that is not RSA, sending nothing', async () => {
      const ecKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
        .privateKey.export({ type: 'pkcs8', format: 'pem' })
        .toString();

      await expectToRejectCode(
        createInstallationToken({ ...options, privateKey: ecKey }),
        ERRORS.GITHUB_PRIVATE_KEY_INVALID,
      );
      expect(server.requestCount()).toBe(0);
    });
  });

  describe('a request that fails', () => {
    test('reports the status of a refused request, once, without retrying', async () => {
      answerTokenRequest({ message: `Bad credentials for ${TOKEN}` }, 401);

      const error = await catchRejection(createInstallationToken(options));

      expect(error).toMatchObject({
        code: ERRORS.GITHUB_REQUEST_FAILED,
        data: { kind: 'HTTP_ERROR', status: 401, rateLimitDeadline: null },
      });
      expect(server.requests(TOKEN_PATH)).toHaveLength(1);
      expectNoCredentials(error);
    });

    test('never retries a server error', async () => {
      answerTokenRequest({ message: 'Server Error' }, 503);

      await expectToRejectCode(createInstallationToken(options), ERRORS.GITHUB_REQUEST_FAILED);
      expect(server.requests(TOKEN_PATH)).toHaveLength(1);
    });

    test('gives the rate limit deadline of a rate limited request', async () => {
      const reset = Math.floor(Date.now() / 1000) + 120;
      server.route(TOKEN_PATH, (_request, response) => {
        sendJson(
          response,
          403,
          { message: 'API rate limit exceeded for installation.' },
          { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) },
        );
      });

      const error = await catchRejection(createInstallationToken(options));

      expect(error).toMatchObject({
        code: ERRORS.GITHUB_REQUEST_FAILED,
        data: { status: 403, rateLimitDeadline: new Date(reset * 1000).toISOString() },
      });
    });

    test('refuses a redirect, without following it', async () => {
      server.route(TOKEN_PATH, (_request, response) => {
        response.writeHead(302, { location: `${server.origin}/elsewhere` }).end();
      });

      const error = await catchRejection(createInstallationToken(options));

      expect(error).toMatchObject({
        code: ERRORS.GITHUB_REQUEST_FAILED,
        data: { kind: 'NETWORK_ERROR', status: null },
      });
      expect(server.requests('/elsewhere')).toHaveLength(0);
    });

    test('refuses an answer over the size limit', async () => {
      answerTokenRequest(buildTokenResponse({ padding: 'x'.repeat(4096) }));

      const error = await catchRejection(
        createInstallationToken({ ...options, maxResponseBytes: 1024 }),
      );

      expect(error).toMatchObject({ code: ERRORS.GITHUB_RESPONSE_INVALID });
      expectNoCredentials(error);
    });

    test('refuses an answer that is not JSON', async () => {
      server.route(TOKEN_PATH, (_request, response) => {
        response.writeHead(201, { 'content-type': 'application/json' }).end(`token=${TOKEN}`);
      });

      const error = await catchRejection(createInstallationToken(options));

      expect(error).toMatchObject({ code: ERRORS.GITHUB_RESPONSE_INVALID });
      expectNoCredentials(error);
    });

    test('stops at its timeout', async () => {
      server.route(TOKEN_PATH, () => {
        // never answers
      });

      const error = await catchRejection(
        createInstallationToken({ ...options, timeoutSeconds: 0.5 }),
      );

      expect(error).toMatchObject({
        code: ERRORS.GITHUB_REQUEST_FAILED,
        data: { kind: 'TIMEOUT', status: null },
      });
    });

    test('stops when its signal aborts', async () => {
      server.route(TOKEN_PATH, () => {
        // never answers
      });
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 100);

      await expect(
        createInstallationToken({ ...options, signal: controller.signal }),
      ).rejects.toMatchObject({ code: ERRORS.GITHUB_REQUEST_FAILED, data: { kind: 'ABORTED' } });
    });
  });

  describe('revokeInstallationToken', () => {
    test('revokes the token with DELETE /installation/token', async () => {
      await revokeInstallationToken(TOKEN, { userAgent: USER_AGENT, apiOrigin: server.origin });

      const [revocation] = server.requests(REVOKE_PATH);
      expect(revocation?.method).toBe('DELETE');
      expect(revocation?.headers).toMatchObject({
        authorization: `Bearer ${TOKEN}`,
        'user-agent': USER_AGENT,
        'x-github-api-version': GITHUB_API_VERSION,
      });
    });

    test.each([
      [401, 'HTTP_ERROR'],
      [404, 'HTTP_ERROR'],
      [200, 'UNEXPECTED_STATUS'],
    ])('fails when GitHub answers %d, without the token', async (status, kind) => {
      server.route(REVOKE_PATH, (_request, response) => {
        sendJson(response, status, { message: `token ${TOKEN}` });
      });

      const error = await catchRejection(
        revokeInstallationToken(TOKEN, { userAgent: USER_AGENT, apiOrigin: server.origin }),
      );

      expect(error).toMatchObject({
        code: ERRORS.GITHUB_TOKEN_REVOKE_FAILED,
        data: { kind, status },
      });
      expect(server.requests(REVOKE_PATH)).toHaveLength(1);
      expectNoValue(error, TOKEN);
    });

    test('fails when its signal aborts', async () => {
      server.route(REVOKE_PATH, () => {
        // never answers
      });

      const error = await catchRejection(
        revokeInstallationToken(TOKEN, {
          userAgent: USER_AGENT,
          apiOrigin: server.origin,
          signal: AbortSignal.timeout(100),
        }),
      );

      expect(error).toMatchObject({
        code: ERRORS.GITHUB_TOKEN_REVOKE_FAILED,
        data: { status: null },
      });
      expectNoValue(error, TOKEN);
    });

    test('fails without an answer', async () => {
      const closed = await startTestServer();
      const origin = closed.origin;
      await closed.close();

      const error = await catchRejection(
        revokeInstallationToken(TOKEN, { userAgent: USER_AGENT, apiOrigin: origin }),
      );

      expect(error).toMatchObject({
        code: ERRORS.GITHUB_TOKEN_REVOKE_FAILED,
        data: { kind: 'NETWORK_ERROR', status: null },
      });
      expectNoValue(error, TOKEN);
    });

    test.each([
      ['an empty token', '', {}],
      ['a token with a line break', `${TOKEN}\n`, {}],
      ['a timeout of 0', TOKEN, { timeoutSeconds: 0 }],
    ])('refuses %s, sending nothing', async (_description, token, overrides) => {
      await expectToRejectCode(
        revokeInstallationToken(token, {
          userAgent: USER_AGENT,
          apiOrigin: server.origin,
          ...overrides,
        }),
        ERRORS.GITHUB_INVALID_ARGUMENT,
      );
      expect(server.requestCount()).toBe(0);
    });
  });
});
