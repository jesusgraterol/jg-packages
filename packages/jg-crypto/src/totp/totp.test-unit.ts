// @vitest-environment node
import { expectToRejectCode } from 'jg-exception/testing';
import { generate, generateSecret } from 'otplib';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { generateTotpSecret, verifyTotp } from './totp.js';
import { decodeBase32 } from './utilities.js';

// RFC 6238's SHA-1 secret, the ASCII bytes of '12345678901234567890', as base32
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

// a claim that accepts every step, and records the steps it was called with
const acceptEveryStep = () => vi.fn<(step: number) => boolean>(() => true);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Generates a code with otplib, an independent implementation, for a secret at a time.
 * @param secret The secret.
 * @param epochSeconds The time, in seconds since the epoch.
 * @returns A promise that resolves to the code.
 */
const otplibCode = (secret: string, epochSeconds: number): Promise<string> =>
  generate({
    strategy: 'totp',
    algorithm: 'sha1',
    digits: 6,
    period: 30,
    secret,
    epoch: epochSeconds,
  });

describe('verifyTotp', () => {
  test.each([
    [59, '287082'],
    [1_111_111_109, '081804'],
    [1_111_111_111, '050471'],
    [1_234_567_890, '005924'],
    [2_000_000_000, '279037'],
    [20_000_000_000, '353130'],
  ])(
    "accepts RFC 6238's SHA-1 code at %d seconds, the last 6 of its 8 digits, %s",
    async (seconds, code) => {
      vi.setSystemTime(seconds * 1000);
      const claimStep = acceptEveryStep();

      await verifyTotp(RFC_SECRET, code, { claimStep });

      expect(claimStep).toHaveBeenCalledExactlyOnceWith(Math.floor(seconds / 30));
    },
  );

  test('accepts a code otplib generates for a generated secret, and for its own secret', async () => {
    vi.setSystemTime(1_800_000_000_000);
    for (const secret of [generateTotpSecret(), generateSecret({ length: 20 })]) {
      const code = await otplibCode(secret, 1_800_000_000);

      await expect(
        verifyTotp(secret, code, { claimStep: acceptEveryStep() }),
      ).resolves.toBeUndefined();
    }
  });

  test.each([[-2], [-1], [1], [2]])(
    'accepts a code from %d steps away, and claims that step',
    async (offset) => {
      const now = 1_800_000_000;
      vi.setSystemTime(now * 1000);
      const claimStep = acceptEveryStep();

      await verifyTotp(RFC_SECRET, await otplibCode(RFC_SECRET, now + offset * 30), { claimStep });

      expect(claimStep).toHaveBeenCalledExactlyOnceWith(Math.floor(now / 30) + offset);
    },
  );

  test.each([[-3], [3]])('refuses a code from %d steps away with TOTP_INVALID', async (offset) => {
    const now = 1_800_000_000;
    vi.setSystemTime(now * 1000);
    const claimStep = acceptEveryStep();

    await expectToRejectCode(
      verifyTotp(RFC_SECRET, await otplibCode(RFC_SECRET, now + offset * 30), { claimStep }),
      ERRORS.TOTP_INVALID,
    );
    expect(claimStep).not.toHaveBeenCalled();
  });

  test.each([['12345'], ['1234567'], ['abcdef'], ['12 456'], [''], [123456 as unknown as string]])(
    'refuses the malformed code %j with TOTP_INVALID',
    async (code) => {
      await expectToRejectCode(
        verifyTotp(RFC_SECRET, code, { claimStep: acceptEveryStep() }),
        ERRORS.TOTP_INVALID,
        'The code is not valid.',
      );
    },
  );

  test('throws TOTP_ALREADY_USED when the step was already claimed', async () => {
    vi.setSystemTime(59_000);

    await expectToRejectCode(
      verifyTotp(RFC_SECRET, '287082', { claimStep: () => Promise.resolve(false) }),
      ERRORS.TOTP_ALREADY_USED,
      'The code was already used.',
    );
  });

  test('passes on what claimStep rejects with, having called it once', async () => {
    vi.setSystemTime(59_000);
    const failure = new Error('Redis is unavailable.');
    const claimStep = vi.fn(() => Promise.reject(failure));

    await expect(verifyTotp(RFC_SECRET, '287082', { claimStep })).rejects.toBe(failure);
    expect(claimStep).toHaveBeenCalledTimes(1);
  });

  test('reads the secret in any letter case, with or without padding', async () => {
    vi.setSystemTime(59_000);

    for (const secret of [
      RFC_SECRET.toLowerCase(),
      `${RFC_SECRET}`,
      'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ======',
    ]) {
      await expect(
        verifyTotp(secret, '287082', { claimStep: acceptEveryStep() }),
      ).resolves.toBeUndefined();
    }
  });

  test.each([
    ['a character outside base32', `${RFC_SECRET.slice(0, -1)}1`],
    ['a space', `GEZD GNBVGY3TQOJQGEZDGNBVGY3TQOJQ`],
    ['padding in the middle', `GEZD=GNBVGY3TQOJQGEZDGNBVGY3TQOJQ`],
    ['fewer than 16 bytes', 'GEZDGNBVGY3TQOJQGEZDGNBV'],
    ['nothing', ''],
    ['no text at all', 20 as unknown as string],
  ])('refuses a secret with %s with INVALID_TOTP_SECRET', async (_, secret) => {
    await expectToRejectCode(
      verifyTotp(secret, '287082', { claimStep: acceptEveryStep() }),
      ERRORS.INVALID_TOTP_SECRET,
    );
  });
});

describe('generateTotpSecret', () => {
  test('writes 20 random bytes as 32 characters of base32', () => {
    const first = generateTotpSecret();
    const second = generateTotpSecret();

    expect(first).toMatch(/^[A-Z2-7]{32}$/);
    expect(decodeBase32(first)).toHaveLength(20);
    expect(first).not.toBe(second);
  });
});
