// the request header the client sends the widget's token in
export const TURNSTILE_TOKEN_HEADER = 'x-turnstile-token';

// the token TurnstileGuard reads its options from, provided with `useValue` or `useFactory`
export const TURNSTILE_GUARD_OPTIONS = Symbol('TURNSTILE_GUARD_OPTIONS');

// Cloudflare's endpoint that verifies a token
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// the longest token Cloudflare issues, in characters
export const MAX_TOKEN_LENGTH = 2048;

// the most bytes of siteverify's answer read, which holds a few short fields
export const MAX_SITEVERIFY_RESPONSE_BYTES = 16_384;

/*
 * The error codes siteverify answers with when the client's token is the problem: missing,
 * invalid or expired, or already used. Any other code means the request or the secret is wrong, or
 * Cloudflare failed.
 */
export const CLIENT_ERROR_CODES: readonly string[] = [
  'missing-input-response',
  'invalid-input-response',
  'timeout-or-duplicate',
];
