// the SHA-2 algorithms hashValue computes
export type IHashAlgorithm = 'sha256' | 'sha384' | 'sha512';

// the text encodings generateRandomBytes returns, both safe in URLs and file names
export type IRandomBytesEncoding = 'base64url' | 'hex';

// the options accepted by signHmac and verifyHmac
export type IHmacOptions = {
  /*
   * The purpose the signature is for, such as 'cursor' or 'checkpoint'. The signing key becomes
   * HMAC-SHA256(secret, domain), so a signature made for one purpose never verifies for another,
   * even with the same secret. Without it, the secret signs directly, as webhook providers expect.
   */
  domain?: string | undefined;
};
