// @vitest-environment node
import { expectToRejectCode, expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';

import type { IVerificationPolicy } from './types.js';
import { createVerificationChallenges } from './verification.js';

const POLICY: IVerificationPolicy = {
  validitySeconds: 600,
  maxFailedAttempts: 5,
  issueLimit: 5,
  issueWindowSeconds: 3_600,
};

const BINDING = { actorId: '42', actionId: 'verify-email', targetId: 'ada@example.com' };

// a token of the issued shape: 43 base64url characters
const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ-_01234';

/**
 * Builds a database whose every call is a spy, so a test can tell nothing reached it.
 * @returns The database and its spies.
 */
const createSpiedPostgres = (): { postgres: IPostgres; query: unknown; transaction: unknown } => {
  const query = vi.fn();
  const transaction = vi.fn();
  return { postgres: { query, transaction } as unknown as IPostgres, query, transaction };
};

describe('createVerificationChallenges', () => {
  test.each<[string, Record<string, unknown>]>([
    ['no policies', { policies: {} }],
    ['policies that are not an object', { policies: null }],
    ['an empty action id', { policies: { '': POLICY } }],
    ['an action id of 129 characters', { policies: { ['a'.repeat(129)]: POLICY } }],
    ['a policy that is not an object', { policies: { 'verify-email': 5 } }],
    [
      'a validity of 0 seconds',
      { policies: { 'verify-email': { ...POLICY, validitySeconds: 0 } } },
    ],
    [
      'a fractional validity',
      { policies: { 'verify-email': { ...POLICY, validitySeconds: 1.5 } } },
    ],
    [
      'a missing validity',
      { policies: { 'verify-email': { ...POLICY, validitySeconds: undefined } } },
    ],
    [
      'no failed attempts allowed',
      { policies: { 'verify-email': { ...POLICY, maxFailedAttempts: 0 } } },
    ],
    [
      '32,768 failed attempts',
      { policies: { 'verify-email': { ...POLICY, maxFailedAttempts: 32_768 } } },
    ],
    ['an issue limit of 0', { policies: { 'verify-email': { ...POLICY, issueLimit: 0 } } }],
    ['a fractional issue limit', { policies: { 'verify-email': { ...POLICY, issueLimit: 2.5 } } }],
    [
      'an infinite issue window',
      { policies: { 'verify-email': { ...POLICY, issueWindowSeconds: Infinity } } },
    ],
    ['a resend limit of 0', { policies: { 'verify-email': { ...POLICY, resendLimit: 0 } } }],
    [
      'a resend limit of 32,768',
      { policies: { 'verify-email': { ...POLICY, resendLimit: 32_768 } } },
    ],
    [
      'a fractional resend limit',
      { policies: { 'verify-email': { ...POLICY, resendLimit: 1.5 } } },
    ],
    [
      'a resend cooldown of 0 seconds',
      { policies: { 'verify-email': { ...POLICY, resendCooldownSeconds: 0 } } },
    ],
    [
      'a fractional resend cooldown',
      { policies: { 'verify-email': { ...POLICY, resendCooldownSeconds: 2.5 } } },
    ],
    ['a code length of 3', { policies: { 'verify-email': POLICY }, codeLength: 3 }],
    ['a code length of 11', { policies: { 'verify-email': POLICY }, codeLength: 11 }],
    ['a fractional code length', { policies: { 'verify-email': POLICY }, codeLength: 6.5 }],
  ])('throws INVALID_VERIFICATION_POLICY for %s', (_, options) => {
    const { postgres } = createSpiedPostgres();

    expectToThrowCode(
      () => createVerificationChallenges(postgres, options as never),
      ERRORS.INVALID_VERIFICATION_POLICY,
      'The verification challenges need at least one policy',
    );
  });

  test('accepts the edges of every range', () => {
    const { postgres } = createSpiedPostgres();

    expect(
      Object.keys(
        createVerificationChallenges(postgres, {
          policies: {
            a: {
              validitySeconds: 1,
              maxFailedAttempts: 1,
              issueLimit: 1,
              issueWindowSeconds: 1,
              resendLimit: 1,
              resendCooldownSeconds: 1,
            },
            ['b'.repeat(128)]: { ...POLICY, maxFailedAttempts: 32_767, resendLimit: 32_767 },
          },
          codeLength: 10,
        }),
      ),
    ).toStrictEqual(['issue', 'resend', 'consume']);
    expect(() =>
      createVerificationChallenges(postgres, { policies: { a: POLICY }, codeLength: 4 }),
    ).not.toThrow();
  });

  test('keeps the policies it was created with', async () => {
    const { postgres, transaction } = createSpiedPostgres();
    const policies: Record<string, IVerificationPolicy> = { 'verify-email': { ...POLICY } };
    const challenges = createVerificationChallenges(postgres, { policies });
    delete policies['verify-email'];

    vi.mocked(transaction as () => Promise<unknown>).mockResolvedValueOnce({
      outcome: 'limit',
      retryAt: '2026-10-19T00:00:00.000Z',
    });

    await expect(challenges.issue(BINDING, () => undefined)).resolves.toStrictEqual({
      outcome: 'limit',
      retryAt: '2026-10-19T00:00:00.000Z',
    });
  });
});

describe('issue and consume input', () => {
  test.each<[string, Record<string, unknown>]>([
    ['an empty actor id', { actorId: '' }],
    ['an actor id of 257 characters', { actorId: 'a'.repeat(257) }],
    ['an actor id that is not a string', { actorId: 42 }],
    ['an action id without a policy', { actionId: 'verify-phone' }],
    ['an action id that is not a string', { actionId: 7 }],
    ['an inherited property as the action id', { actionId: 'toString' }],
    ['an empty target id', { targetId: '' }],
    ['a target id of 257 characters', { targetId: 'a'.repeat(257) }],
  ])(
    'rejects %s with INVALID_VERIFICATION_INPUT, before touching the database',
    async (_, overrides) => {
      const { postgres, query, transaction } = createSpiedPostgres();
      const challenges = createVerificationChallenges(postgres, {
        policies: { 'verify-email': POLICY },
      });
      const binding = { ...BINDING, ...overrides };

      await expectToRejectCode(
        challenges.issue(binding, () => undefined),
        ERRORS.INVALID_VERIFICATION_INPUT,
        'The verification input needs an actor id of 1 to 256 characters',
      );
      await expectToRejectCode(
        challenges.consume({ ...binding, challengeToken: TOKEN, code: '123456' }),
        ERRORS.INVALID_VERIFICATION_INPUT,
      );
      await expectToRejectCode(
        challenges.resend({ ...binding, challengeToken: TOKEN }, () => undefined),
        ERRORS.INVALID_VERIFICATION_INPUT,
      );
      expect(transaction).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    },
  );

  test('rejects an issue without a delivery function', async () => {
    const { postgres, transaction } = createSpiedPostgres();
    const challenges = createVerificationChallenges(postgres, {
      policies: { 'verify-email': POLICY },
    });

    await expectToRejectCode(
      challenges.issue(BINDING, 'email' as never),
      ERRORS.INVALID_VERIFICATION_INPUT,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  test('rejects a resend without a delivery function, or for a policy without a resend limit', async () => {
    const { postgres, query, transaction } = createSpiedPostgres();
    const challenges = createVerificationChallenges(postgres, {
      policies: { 'verify-email': POLICY, 'verify-phone': { ...POLICY, resendLimit: 3 } },
    });

    await expectToRejectCode(
      challenges.resend({ ...BINDING, challengeToken: TOKEN }, () => undefined),
      ERRORS.INVALID_VERIFICATION_INPUT,
      'and to resend, a policy with a resend limit',
    );
    await expectToRejectCode(
      challenges.resend(
        { ...BINDING, actionId: 'verify-phone', challengeToken: TOKEN },
        'email' as never,
      ),
      ERRORS.INVALID_VERIFICATION_INPUT,
    );
    expect(transaction).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  test.each([
    ['a token of 42 characters', TOKEN.slice(1)],
    ['a token that is not a string', null],
  ])('resolves a resend with %s to invalid, without touching the database', async (_, token) => {
    const { postgres, query, transaction } = createSpiedPostgres();
    const challenges = createVerificationChallenges(postgres, {
      policies: { 'verify-email': { ...POLICY, resendLimit: 3 } },
    });
    const deliver = vi.fn();

    await expect(
      challenges.resend({ ...BINDING, challengeToken: token as never }, deliver),
    ).resolves.toStrictEqual({ outcome: 'invalid' });
    expect(transaction).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });

  test.each<[string, Record<string, unknown>]>([
    ['a token of 42 characters', { challengeToken: TOKEN.slice(1) }],
    ['a token that is not a string', { challengeToken: null }],
    ['a code with a letter', { code: '12345a' }],
    ['a code of 5 digits', { code: '12345' }],
    ['a code that is not a string', { code: 123_456 }],
  ])('resolves to false for %s, without touching the database', async (_, overrides) => {
    const { postgres, query } = createSpiedPostgres();
    const challenges = createVerificationChallenges(postgres, {
      policies: { 'verify-email': POLICY },
    });

    await expect(
      challenges.consume({ ...BINDING, challengeToken: TOKEN, code: '123456', ...overrides }),
    ).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
});
