import type { IRandomBytesEncoding } from '../shared/index.js';

// the most bytes generateRandomBytes produces in one call, which keeps the synchronous read short
export const MAX_RANDOM_BYTE_LENGTH = 65_536;

// the most digits generateRandomDigits produces in one call
export const MAX_RANDOM_DIGIT_COUNT = 256;

// the encodings generateRandomBytes accepts, checked at runtime for callers without types
export const RANDOM_BYTES_ENCODINGS: readonly unknown[] = [
  'base64url',
  'hex',
] satisfies IRandomBytesEncoding[];
