import { hashValue } from 'jg-crypto';
import { Exception } from 'jg-exception';
import { isIntegerValid } from 'jg-utilities';

import { createAdvisoryLockKey } from '../locks/index.js';
import { ERRORS, isBoundedString } from '../shared/index.js';

import type { IVerificationBinding, IVerificationPolicy } from './types.js';

// a token's shape: 32 random bytes as base64url, which is 43 characters without padding
const CHALLENGE_TOKEN_PATTERN = /^[\w-]{43}$/;

// the most failed attempts a policy allows, so the smallint count never overflows
const MAX_FAILED_ATTEMPTS = 32_767;

/**
 * Builds the exception for policies or a code length that aren't valid.
 * @returns The INVALID_VERIFICATION_POLICY exception.
 */
const invalidPolicy = (): Exception =>
  new Exception(
    'The verification challenges need at least one policy, each for an action id of 1 to 128 characters, with whole validity and window seconds of at least 1, a whole issue limit of at least 1, and a whole failed-attempt limit from 1 to 32767, and a whole code length from 4 to 10.',
    { code: ERRORS.INVALID_VERIFICATION_POLICY },
  );

/**
 * Builds the exception for a binding or a delivery function that isn't valid.
 * @returns The INVALID_VERIFICATION_INPUT exception.
 */
export const invalidInput = (): Exception =>
  new Exception(
    'The verification input needs an actor id of 1 to 256 characters, an action id with a policy, a target id of 1 to 256 characters, and, to issue, a delivery function.',
    { code: ERRORS.INVALID_VERIFICATION_INPUT },
  );

/**
 * Checks whether a value is a valid policy.
 * @param policy The value.
 * @returns Whether it is.
 */
const isPolicyValid = (policy: unknown): policy is IVerificationPolicy => {
  if (typeof policy !== 'object' || policy === null) {
    return false;
  }
  const { validitySeconds, maxFailedAttempts, issueLimit, issueWindowSeconds } = policy as Partial<
    Record<keyof IVerificationPolicy, unknown>
  >;
  return (
    isIntegerValid(validitySeconds, 1) &&
    isIntegerValid(maxFailedAttempts, 1, MAX_FAILED_ATTEMPTS) &&
    isIntegerValid(issueLimit, 1) &&
    isIntegerValid(issueWindowSeconds, 1)
  );
};

/**
 * Validates the policies and the code length, and copies the policies, so changing the object
 * afterwards changes nothing.
 * @param policies Each action's policy, keyed by its action id.
 * @param codeLength The code's digits.
 * @returns The policies, by action id.
 * @throws
 * - INVALID_VERIFICATION_POLICY: The verification challenges need at least one policy, each for an action id of 1 to 128 characters, with whole validity and window seconds of at least 1, a whole issue limit of at least 1, and a whole failed-attempt limit from 1 to 32767, and a whole code length from 4 to 10.
 */
export const readPolicies = (
  policies: unknown,
  codeLength: unknown,
): Map<string, IVerificationPolicy> => {
  if (typeof policies !== 'object' || policies === null || !isIntegerValid(codeLength, 4, 10)) {
    throw invalidPolicy();
  }
  const entries = Object.entries(policies);
  if (
    entries.length === 0 ||
    entries.some(([actionId, policy]) => !isBoundedString(actionId, 128) || !isPolicyValid(policy))
  ) {
    throw invalidPolicy();
  }
  return new Map(
    entries.map(([actionId, policy]: [string, IVerificationPolicy]) => [actionId, { ...policy }]),
  );
};

/**
 * Validates a binding, and gives its action's policy.
 * @param policies The policies, by action id.
 * @param binding The actor, action, and target.
 * @returns The action's policy.
 * @throws
 * - INVALID_VERIFICATION_INPUT: The verification input needs an actor id of 1 to 256 characters, an action id with a policy, a target id of 1 to 256 characters, and, to issue, a delivery function.
 */
export const readBindingPolicy = (
  policies: Map<string, IVerificationPolicy>,
  { actorId, actionId, targetId }: IVerificationBinding,
): IVerificationPolicy => {
  const policy = typeof actionId === 'string' ? policies.get(actionId) : undefined;
  if (policy === undefined || !isBoundedString(actorId, 256) || !isBoundedString(targetId, 256)) {
    throw invalidInput();
  }
  return policy;
};

/**
 * Checks whether a value has a challenge token's shape, before it's hashed and looked up.
 * @param value The value.
 * @returns Whether it does.
 */
export const isChallengeTokenValid = (value: unknown): value is string =>
  typeof value === 'string' && CHALLENGE_TOKEN_PATTERN.test(value);

/**
 * Checks whether a value has a code's shape: exactly the expected count of ASCII digits.
 * @param value The value.
 * @param codeLength The code's digits.
 * @returns Whether it does.
 */
export const isCodeValid = (value: unknown, codeLength: number): value is string =>
  typeof value === 'string' && value.length === codeLength && /^\d+$/.test(value);

/**
 * Hashes a challenge's code together with its token, prefixed with the token's length, so no other
 * token and code can produce the same text. The code alone has too few values to hash safely.
 * @param challengeToken The challenge's token.
 * @param code The code.
 * @returns The SHA-256 hash, as 64 hexadecimal characters.
 */
export const hashChallengeCode = (challengeToken: string, code: string): string =>
  hashValue(`${String(challengeToken.length)}:${challengeToken}:${code}`);

/**
 * Builds the transaction advisory lock key that serializes issuing an action's challenges to one
 * actor, so concurrent issues can't exceed the limit. The action id's length prefix keeps an
 * action and actor pair from sharing a key with another split of the same text.
 * @param actorId The actor.
 * @param actionId The action.
 * @returns The key, a signed 64-bit integer as a string.
 */
export const createIssueLockKey = (actorId: string, actionId: string): string =>
  createAdvisoryLockKey(
    `jg-postgres:verification:${String(actionId.length)}:${actionId}:${actorId}`,
  );
