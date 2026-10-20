import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import {
  TOTP_MIN_SECRET_BYTES,
  TOTP_PARAMETERS,
  TOTP_SECRET_BYTES,
  TOTP_WINDOW_STEPS,
} from './constants.js';
import type { IVerifyTotpOptions } from './types.js';
import { computeHotp, decodeBase32, encodeBase32 } from './utilities.js';

/**
 * Generates a secret for a TOTP authenticator app: 20 random bytes, 160 bits, as RFC 4226
 * recommends, written as 32 characters of base32, the form apps and their QR codes take.
 * @returns The secret.
 * @example
 * import { generateTotpSecret } from 'jg-crypto';
 *
 * const secret = generateTotpSecret(); // such as 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
 */
export const generateTotpSecret = (): string => encodeBase32(randomBytes(TOTP_SECRET_BYTES));

/**
 * Checks a code from an authenticator app against its secret, as RFC 6238 computes it with
 * `TOTP_PARAMETERS`: HMAC-SHA1, 6 digits, and 30-second steps. A code from up to 2 steps before or
 * after the current one is accepted, for clocks that drift. Every step is compared in constant time.
 *
 * A code that matches is then claimed with `claimStep`, which is required, because a code an
 * attacker sees can otherwise be used again within its window: it runs once, with the code's step,
 * and resolves to whether this call claimed it. Store the claim where every server that verifies
 * codes can see it, such as Redis, for at least 150 seconds, the window's length.
 * @param secret The secret, base32 in any letter case, with or without padding.
 * @param code The 6-digit code.
 * @param options The function that claims the code's step.
 * @returns A promise that resolves once the code is verified and claimed.
 * @example
 * import { verifyTotp } from 'jg-crypto';
 *
 * // the steps already used, kept in memory, so for a single process only
 * const usedSteps = new Set<number>();
 *
 * await verifyTotp('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', '123456', {
 *   claimStep: (step) => {
 *     if (usedSteps.has(step)) {
 *       return false;
 *     }
 *     usedSteps.add(step);
 *     return true;
 *   },
 * });
 * @throws
 * - INVALID_TOTP_SECRET: The TOTP secret must be base32 of at least 16 bytes.
 * - TOTP_INVALID: The code is not valid.
 * - TOTP_ALREADY_USED: The code was already used.
 * - What `claimStep` throws or rejects with.
 */
export const verifyTotp = async (
  secret: string,
  code: string,
  { claimStep }: IVerifyTotpOptions,
): Promise<void> => {
  const key = typeof secret === 'string' ? decodeBase32(secret) : null;
  if (key === null || key.length < TOTP_MIN_SECRET_BYTES) {
    throw new Exception('The TOTP secret must be base32 of at least 16 bytes.', {
      code: ERRORS.INVALID_TOTP_SECRET,
    });
  }
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new Exception('The code is not valid.', { code: ERRORS.TOTP_INVALID });
  }
  const currentStep = Math.floor(Date.now() / 1000 / TOTP_PARAMETERS.periodSeconds);
  const given = Buffer.from(code);
  let matchedStep: number | undefined;
  /*
   * every step in the window is compared, so the time taken doesn't tell which one matched; a
   * window that starts before the epoch, as RFC 6238's first test time does, skips the negative steps
   */
  for (let offset = -TOTP_WINDOW_STEPS; offset <= TOTP_WINDOW_STEPS; offset += 1) {
    const step = currentStep + offset;
    if (step >= 0 && timingSafeEqual(Buffer.from(computeHotp(key, step)), given)) {
      matchedStep ??= step;
    }
  }
  if (matchedStep === undefined) {
    throw new Exception('The code is not valid.', { code: ERRORS.TOTP_INVALID });
  }
  if (!(await claimStep(matchedStep))) {
    throw new Exception('The code was already used.', { code: ERRORS.TOTP_ALREADY_USED });
  }
};
