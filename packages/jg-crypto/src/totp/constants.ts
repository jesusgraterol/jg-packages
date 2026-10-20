// the TOTP every authenticator app supports, which verifyTotp checks: HMAC-SHA1, 6 digits, and
// 30-second steps, as RFC 6238 defaults to
export const TOTP_PARAMETERS = { algorithm: 'SHA1', digits: 6, periodSeconds: 30 } as const;

// the steps before and after the current one a code may come from, for clocks that drift
export const TOTP_WINDOW_STEPS = 2;

// the bytes of a secret generateTotpSecret draws, 160 bits, as RFC 4226 recommends
export const TOTP_SECRET_BYTES = 20;

// the fewest bytes a secret verifyTotp accepts may hold, 128 bits, the minimum RFC 4226 sets
export const TOTP_MIN_SECRET_BYTES = 16;

// the RFC 4648 base32 alphabet secrets are written in
export const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
