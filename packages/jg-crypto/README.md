# jg-crypto

Hashing, random bytes and digits, HMAC signatures with constant-time verification, and authenticator app codes, for Node.js.

## Install

```bash
npm install jg-crypto
```

## Usage

Generate an opaque token, such as for a sign-in link, and store only its hash, so a leaked table can't be used to sign in:

```ts
import { generateRandomBytes, hashValue } from 'jg-crypto';

const token = generateRandomBytes(32); // 43 base64url characters, sent to the user
const tokenHash = hashValue(token); // 64 hex characters, stored in the database
```

Generate a one-time code for an email, with its leading zeros kept:

```ts
import { generateRandomDigits } from 'jg-crypto';

const code = generateRandomDigits(6); // such as '042917'
```

Verify a webhook signature over the request's raw body, compared in constant time:

```ts
import { verifyHmac } from 'jg-crypto';

const isAuthentic = verifyHmac(rawBody, signature, webhookSecret);
```

Give each purpose its own signing key with a `domain`, so a signature made for one kind of value never verifies for another, even under the same secret:

```ts
import { signHmac, verifyHmac } from 'jg-crypto';

const signature = signHmac(cursorJson, secret, { domain: 'cursor' });
verifyHmac(cursorJson, signature, secret, { domain: 'checkpoint' }); // false
```

`verifyHmac` returns false for any signature but the exact one, and never throws for a bad signature. An empty secret or domain throws, because it's the program's own mistake.

Check a code from an authenticator app, claiming its time step so it can't be used twice. `claimStep` is required, and works with any store that can record a step once, such as Redis for several servers:

```ts
import { generateTotpSecret, verifyTotp } from 'jg-crypto';

const secret = generateTotpSecret(); // 32 base32 characters, shown to the user as a QR code
await verifyTotp(secret, code, { claimStep: (step) => claimForUser(userId, step) });
```

A wrong code throws `TOTP_INVALID`, and a code already used throws `TOTP_ALREADY_USED`. Codes follow RFC 6238 as every authenticator app does: HMAC-SHA1, 6 digits, and 30-second steps, accepted up to 2 steps early or late.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-crypto/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-crypto/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-crypto/LICENSE)
