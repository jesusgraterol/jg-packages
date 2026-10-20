import { createHmac } from 'node:crypto';

import { BASE32_ALPHABET, TOTP_PARAMETERS } from './constants.js';

/**
 * Writes bytes as RFC 4648 base32, in uppercase, without padding.
 * @param bytes The bytes.
 * @returns The base32 text.
 */
export const encodeBase32 = (bytes: Uint8Array): string => {
  let text = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      text += BASE32_ALPHABET[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) {
    text += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  }
  return text;
};

/**
 * Reads RFC 4648 base32 in any letter case, with or without its `=` padding.
 * @param text The base32 text.
 * @returns The bytes, or null when the text holds anything else.
 */
export const decodeBase32 = (text: string): Buffer | null => {
  const unpadded = text.toUpperCase().replace(/=+$/, '');
  if (!/^[A-Z2-7]*$/.test(unpadded)) {
    return null;
  }
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of unpadded) {
    buffer = ((buffer << 5) | BASE32_ALPHABET.indexOf(character)) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
};

/**
 * Computes the RFC 4226 HOTP code for a counter: HMAC-SHA1, dynamic truncation, and the last digits.
 * @param key The secret's bytes.
 * @param counter The counter, a time step for TOTP.
 * @returns The code, padded with zeros to its digits.
 */
export const computeHotp = (key: Uint8Array, counter: number): string => {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(message).digest();
  const offset = (digest[digest.length - 1] as number) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** TOTP_PARAMETERS.digits).padStart(TOTP_PARAMETERS.digits, '0');
};
