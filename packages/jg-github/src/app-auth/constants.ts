// the seconds an App JWT's issue time is set back, for a GitHub clock behind this one
export const JWT_CLOCK_SKEW_SECONDS = 60;

// the seconds an App JWT lasts from now: inside GitHub's ten-minute limit, even with a clock a
// minute ahead of GitHub's
export const JWT_LIFETIME_SECONDS = 540;

// the PEM labels of an unencrypted RSA private key: PKCS#1 and PKCS#8
export const PRIVATE_KEY_PEM_PATTERN = /^-----BEGIN (?:RSA )?PRIVATE KEY-----\r?\n/;

// a GitHub App's ID, or its client ID, such as 'Iv23liAbCdEf0123'
export const APP_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
