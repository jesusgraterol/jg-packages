# jg-github

GitHub App authentication for Node.js: app tokens, scoped installation tokens, webhook signatures, and rate-limit retry times.

## Install

```bash
npm install jg-github
```

## Usage

Create an installation token for exactly the repositories and the permissions a job needs, and revoke it when the job is done:

```ts
import { createInstallationToken, revokeInstallationToken } from 'jg-github';

declare const privateKey: string;

const { token, expiresAt } = await createInstallationToken({
  appId: 123456,
  privateKey,
  installationId: 12345678,
  repositories: ['app', 'docs'], // or repositoryIds: [101, 102]
  permissions: { contents: 'read', pull_requests: 'write' },
  userAgent: 'acme-release-bot',
});
try {
  // call the API with createGithubHeaders(token, { userAgent: 'acme-release-bot' })
} finally {
  await revokeInstallationToken(token, { userAgent: 'acme-release-bot' });
}
```

`permissions` is required and can't be empty, because GitHub grants every permission of the installation to a request without it. The repositories are named by name or by ID, never both, with no repeats. Anything else throws `GITHUB_INVALID_ARGUMENT` before a request is sent. GitHub's answer must match the request exactly: only the selected repositories, the same ones, compared by name ignoring case or by ID as you named them, and the same permissions, plus the `metadata: 'read'` GitHub adds. A token that doesn't match, or that had already expired, is revoked before the error is thrown, and the error's `isRevoked` says whether that worked.

Verify a webhook delivery before parsing its body:

```ts
import { verifyGithubWebhookSignature } from 'jg-github';

declare const rawBody: Buffer;
declare const headers: Record<string, string | string[] | undefined>;
declare const webhookSecret: string;

const isAuthentic = verifyGithubWebhookSignature(
  rawBody,
  headers['x-hub-signature-256'],
  webhookSecret,
);
```

It's false for a header that's missing, repeated, longer than 71 characters, or not `sha256=` and 64 lowercase hexadecimal characters, and compares the signature in constant time.

Find when to retry a rate limited request:

```ts
import { getGithubRateLimitDeadline } from 'jg-github';

declare const response: Response;

const retryAt = getGithubRateLimitDeadline({
  status: response.status,
  headers: response.headers,
  retryCount: 0,
}); // a Date, or null when the response isn't rate limited
```

A 429 is rate limited, and so is a 403 with `Retry-After`, with no requests remaining, or with `hasRateLimitMessage`, and a success that used the last request. The deadline is the latest future one of `Retry-After`, as whole seconds or a strict IMF-fixdate, and `x-ratelimit-reset` when no requests remain; without one, it's a minute from now, doubled for each retry already made.

The rest of the API:

- `createGithubAppJwt({ appId, privateKey })`, the App's own JWT, signed with RS256, issued 60 seconds back and expiring 540 seconds ahead, inside GitHub's ten-minute limit even with a clock a minute ahead. `assertGithubAppPrivateKey(pem)` checks the key at startup: an unencrypted RSA key, PKCS#1 or PKCS#8.
- `createGithubHeaders(token, { userAgent, apiVersion })`, the headers every request sends, with `X-GitHub-Api-Version` set to `GITHUB_API_VERSION` unless you pass another.
- `buildGithubApiUrl(segments, query, { apiOrigin })` and `buildGithubRawContentUrl(location, { rawContentOrigin })`, which encode each value, so a branch's `/` or a `..` can't change the path. `apiOrigin`, such as GitHub Enterprise Server's `https://ghe.example.com/api/v3`, must be https, or http on a loopback host for a test server.

Requests go through jg-fetch with `redirect: 'error'`, a 10-second timeout, a 128 KiB response limit, and no retries, because creating or revoking a token twice isn't safe.

### Errors

| Code                          | When                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GITHUB_PRIVATE_KEY_INVALID`  | The App's private key isn't an unencrypted RSA key, PEM-encoded as PKCS#1 or PKCS#8                                      |
| `GITHUB_INVALID_ARGUMENT`     | An argument isn't valid, such as missing or empty `permissions`, a repeated repository, or an installation ID not digits |
| `GITHUB_REQUEST_FAILED`       | A request fails: an error status, a redirect, a timeout, an abort, or no answer                                          |
| `GITHUB_RESPONSE_INVALID`     | GitHub's answer isn't in the expected format, or is larger than `maxResponseBytes`                                       |
| `GITHUB_TOKEN_SCOPE_MISMATCH` | The granted token reaches other repositories, or has other permissions, than requested                                   |
| `GITHUB_TOKEN_EXPIRED`        | The granted token had already expired                                                                                    |
| `GITHUB_TOKEN_REVOKE_FAILED`  | GitHub answers a revocation with anything but 204, or not at all                                                         |

`GITHUB_REQUEST_FAILED`'s data holds jg-fetch's `kind` of failure, the `status`, and the `rateLimitDeadline` as an ISO string, or null. `GITHUB_TOKEN_SCOPE_MISMATCH`'s data says what differs, `repository_selection`, `repositories`, or `permissions`, and, like `GITHUB_TOKEN_EXPIRED`'s and `GITHUB_RESPONSE_INVALID`'s when GitHub granted a token, whether it was revoked. No error has a cause or holds a token, the App's JWT, the private key, or a response body. `verifyGithubWebhookSignature` throws jg-crypto's `INVALID_HMAC_SECRET` for an empty secret.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-github/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-github/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-github/LICENSE)
