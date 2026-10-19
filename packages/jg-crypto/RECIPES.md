# jg-crypto recipes

Patterns for Node.js services that verify webhooks, keep tokens out of their database, and sign the values they hand to clients.

## Verifying a signed webhook

Use this in the route that receives a provider's webhook deliveries, when the provider signs each request body with a secret you share and sends the HMAC-SHA256 signature, in lowercase hex, in a header such as `x-webhook-signature`. Verify it over the body's exact bytes, before parsing it, because JSON parsing and re-serializing can change the bytes:

```ts
import { verifyHmac } from 'jg-crypto';

// the request as your framework exposes it, with the body kept as raw bytes
type IWebhookRequest = {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
};

// the secret set on the provider's webhook, read from the app's configuration
declare const webhookSecret: string;

// the outcome of a delivery, as a status for the response and the payload when it's authentic
export const receiveWebhook = (request: IWebhookRequest): { status: number; payload?: unknown } => {
  const header = request.headers['x-webhook-signature'];
  // a missing or repeated header is checked as an empty signature, which never matches
  const signature = typeof header === 'string' ? header : '';
  if (!verifyHmac(request.rawBody, signature, webhookSecret)) {
    return { status: 401 };
  }
  return { status: 202, payload: JSON.parse(request.rawBody.toString('utf8')) };
};
```

A missing, repeated, or malformed header yields a signature `verifyHmac` rejects like a wrong one, so the route needs no separate checks. The comparison runs in constant time, so an attacker can't learn the signature by timing the responses. Without a `domain`, the signature is the plain HMAC-SHA256 that webhook providers compute. GitHub's deliveries put `sha256=` before the signature in `X-Hub-Signature-256`; verify them with [jg-github](https://jg-packages.jesusgraterol.dev/packages/jg-github/)'s `verifyGithubWebhookSignature`, which reads that header and refuses a malformed or repeated one.

## Storing a token's hash, never the token

Use this for any secret the app hands out and later checks, such as a password-reset link, an API key, or an invitation. The database keeps only the token's SHA-256, so someone who reads the table can't use what they find:

```ts
import { generateRandomBytes, hashValue } from 'jg-crypto';

// the app's storage for reset tokens, keyed by the token's hash
type IResetTokenStore = {
  save: (record: { tokenHash: string; userId: string; expiresAt: Date }) => Promise<void>;
  findValid: (tokenHash: string) => Promise<{ userId: string } | undefined>;
};

declare const store: IResetTokenStore;

// creates a token that expires in 30 minutes, and returns it for the email link
export const createResetToken = async (userId: string): Promise<string> => {
  const token = generateRandomBytes(32);
  await store.save({
    tokenHash: hashValue(token),
    userId,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  return token;
};

// finds who a token from a link belongs to, by hashing it the same way
export const findResetTokenOwner = async (token: string): Promise<string | undefined> =>
  (await store.findValid(hashValue(token)))?.userId;
```

A 32-byte token has 256 bits of entropy, so its plain SHA-256 is enough: there's nothing to guess. Passwords are different, because people choose them, and need a slow, salted hash such as Node.js's `scrypt` instead.

## Signing values you hand to clients

Use this when a client holds a value the server must trust when it comes back, such as a pagination cursor or a resumable job's checkpoint. Give each kind of value its own `domain`, so a cursor can't be replayed as a checkpoint even though both are signed with the same secret:

```ts
import { signHmac, verifyHmac } from 'jg-crypto';

// the signing secret, read from the app's configuration
declare const signingSecret: string;

// a cursor the client sends back as is: its JSON and the signature over it
export const signCursor = (cursor: { lastId: string }): string => {
  const json = JSON.stringify(cursor);
  return `${Buffer.from(json).toString('base64url')}.${signHmac(json, signingSecret, { domain: 'cursor' })}`;
};

// the cursor, or undefined when it was changed, or signed for another purpose
export const readCursor = (value: string): { lastId: string } | undefined => {
  const [encoded = '', signature = ''] = value.split('.');
  const json = Buffer.from(encoded, 'base64url').toString('utf8');
  if (!verifyHmac(json, signature, signingSecret, { domain: 'cursor' })) {
    return undefined;
  }
  return JSON.parse(json) as { lastId: string };
};
```

The signature proves the server made the value; it doesn't hide it. Anyone can decode the cursor's JSON, so put nothing in it the client shouldn't see.
