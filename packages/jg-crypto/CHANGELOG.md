# Changelog

## 0.3.0

### Added

- `generateTotpSecret()`, a secret for an authenticator app: 20 random bytes as 32 characters of base32.
- `verifyTotp(secret, code, { claimStep })`, which checks a 6-digit code as RFC 6238 computes it, with HMAC-SHA1 and 30-second steps, accepting up to 2 steps before or after the current one, and compares every step in constant time. The required `claimStep` records the matched step and resolves to whether this call recorded it, so a code can't be used twice; it works with any store, such as Redis or a process's memory. A secret that isn't base32 of at least 16 bytes throws `INVALID_TOTP_SECRET`, a malformed or wrong code `TOTP_INVALID`, and a claimed step `TOTP_ALREADY_USED`.
- `TOTP_PARAMETERS` and `IVerifyTotpOptions`.
- A recipe for claiming steps in Redis or in memory.

## 0.2.0

### Changed

- Supports Node.js 22.17.0 and later, down from 24.

## 0.1.2

### Changed

- The webhook recipe verifies any provider that sends the body's HMAC-SHA256 in a header. GitHub's deliveries, whose header puts `sha256=` before the signature, are verified with jg-github's `verifyGithubWebhookSignature` instead. The code is the same.

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `hashValue(value, algorithm?)`, the lowercase hex SHA-256, SHA-384, or SHA-512 digest of a string or bytes. An unsupported algorithm throws `UNSUPPORTED_HASH_ALGORITHM`.
- `generateRandomBytes(byteLength, encoding?)`, 1 to 65,536 cryptographically secure random bytes as base64url, by default, or hex. A byte length outside that range throws `INVALID_BYTE_LENGTH`, and another encoding `UNSUPPORTED_ENCODING`.
- `generateRandomDigits(count)`, 1 to 256 uniformly drawn random digits, leading zeros kept, such as for a one-time code. A count outside that range throws `INVALID_DIGIT_COUNT`.
- `signHmac(message, secret, { domain? })` and `verifyHmac(message, signature, secret, { domain? })`, HMAC-SHA256 signatures in lowercase hex, verified in constant time. A `domain` derives the signing key as `HMAC-SHA256(secret, domain)`, so a signature for one purpose never verifies for another. `verifyHmac` returns false for any signature but the exact one, and an empty secret or domain throws `INVALID_HMAC_SECRET` or `INVALID_HMAC_DOMAIN`.
- `IHashAlgorithm`, `IRandomBytesEncoding`, and `IHmacOptions`.
- Recipes for verifying a GitHub webhook, storing a token's hash instead of the token, and signing values handed to clients.
