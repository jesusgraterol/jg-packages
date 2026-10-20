# Changelog

## 0.2.0

### Changed

- Supports Node.js 22.17.0 and later, down from 24.

## 0.1.0

### Added

- `createInstallationToken(options)`, an installation token for exactly the repositories, by name or by ID, and the permissions asked for. `permissions` is required and non-empty, and a granted token whose repositories, permissions, or repository selection differ, or that has expired, is revoked before `GITHUB_TOKEN_SCOPE_MISMATCH` or `GITHUB_TOKEN_EXPIRED` is thrown. `revokeInstallationToken(token, options)` revokes one, expecting 204.
- `createGithubAppJwt({ appId, privateKey, now })`, the App's RS256 JWT, issued 60 seconds back and expiring 540 seconds ahead, and `assertGithubAppPrivateKey(pem)`, which accepts an unencrypted RSA key as PKCS#1 or PKCS#8.
- `verifyGithubWebhookSignature(rawBody, header, secret)`, which checks `X-Hub-Signature-256` in constant time through jg-crypto, refusing a malformed or repeated header.
- `getGithubRateLimitDeadline(options)`, when to retry a rate limited request, from `Retry-After` and `x-ratelimit-reset`, with an exponential fallback.
- `createGithubHeaders`, `buildGithubApiUrl`, and `buildGithubRawContentUrl`, with `GITHUB_API_ORIGIN`, `GITHUB_RAW_CONTENT_ORIGIN`, and `GITHUB_API_VERSION`.
- Requests through jg-fetch with no redirects, no retries, a 10-second timeout, and a 128 KiB response limit, whose errors never hold a token or a response body.
- Recipes for a scoped installation token revoked when done, and a webhook route.
