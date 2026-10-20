// types
export type { IHashAlgorithm, IHmacOptions, IRandomBytesEncoding } from './shared/index.js';

// error codes
export { ERRORS } from './shared/index.js';

// hashing
export { hashValue } from './hashing/index.js';

// random values
export { generateRandomBytes, generateRandomDigits } from './random/index.js';

// signatures
export { signHmac, verifyHmac } from './hmac/index.js';

// one-time passwords
export {
  type IVerifyTotpOptions,
  TOTP_PARAMETERS,
  generateTotpSecret,
  verifyTotp,
} from './totp/index.js';
