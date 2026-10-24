import { generateRandomBytes, generateRandomDigits, hashValue } from 'jg-crypto';
import { Exception } from 'jg-exception';
import type { PoolClient } from 'pg';

import { lockTransaction } from '../locks/index.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';

import type {
  IVerificationAttempt,
  IVerificationBinding,
  IVerificationChallenges,
  IVerificationChallengesOptions,
  IVerificationDeliver,
  IVerificationDelivery,
  IVerificationIssue,
  IVerificationResend,
  IVerificationResendRequest,
} from './types.js';
import {
  createIssueLockKey,
  hashChallengeCode,
  invalidInput,
  isChallengeTokenValid,
  isCodeValid,
  readBindingPolicy,
  readPolicies,
} from './utilities.js';

// the random bytes in a challenge's token
const TOKEN_BYTE_LENGTH = 32;

// the code's digits when the options don't set them
const DEFAULT_CODE_LENGTH = 6;

// what the issue transaction decides: a committed challenge to deliver, or the limit
type IIssueDecision =
  | { outcome: 'issued'; challengeId: string; expiresAt: string }
  | { outcome: 'limit'; retryAt: string };

// what the resend transaction decides: a committed new code to deliver, or why there's none
type IResendDecision =
  | {
      outcome: 'resent';
      challengeId: string;
      resendCount: number;
      expiresAt: string;
      remainingSeconds: number;
    }
  | { outcome: 'cooldown'; retryAt: string }
  | { outcome: 'limit' }
  | { outcome: 'invalid' };

/*
 * Locks the binding's challenge for the token while it's unused, not superseded, and has attempts
 * left. Expiry isn't part of it: PostgreSQL rechecks these conditions after a wait for the lock only
 * when the call holding it updated the row, so a call judges expiry once it holds the lock, on
 * clock_timestamp(). Concurrent calls wait for the lock, and each then sees the row as the other
 * left it.
 */
const CHALLENGE_LOCK_QUERY = `SELECT id
FROM verification_challenge
WHERE token_hash = $1
  AND actor_id = $2
  AND action_id = $3
  AND target_id = $4
  AND used_at IS NULL
  AND superseded_at IS NULL
  AND failed_attempt_count < $5
FOR UPDATE;`;

// reads a locked challenge's resend count and, on the clock after any wait for the lock, whether it
// expired and when its cooldown, counted from its last send, ends
const RESEND_STATE_QUERY = `SELECT resend_count,
  expires_at <= clock_timestamp() AS is_expired,
  COALESCE(resent_at, created_at) + make_interval(secs => $2) AS cooldown_ends_at,
  COALESCE(resent_at, created_at) + make_interval(secs => $2) > clock_timestamp() AS is_cooling_down
FROM verification_challenge
WHERE id = $1;`;

// stores the new code's hash and counts the resend, keeping the expiry and the failed attempts
const RESEND_UPDATE_QUERY = `UPDATE verification_challenge
SET code_hash = $2,
  resend_count = resend_count + 1,
  resent_at = clock_timestamp()
WHERE id = $1
RETURNING resend_count,
  expires_at,
  GREATEST(0, floor(extract(epoch FROM expires_at - clock_timestamp())))::integer
    AS remaining_seconds;`;

// uses a locked challenge when the code's hash matches, or counts one failed attempt, unless it
// expired, which leaves it unchanged
const CONSUME_UPDATE_QUERY = `UPDATE verification_challenge
SET used_at = CASE WHEN code_hash = $2 THEN clock_timestamp() END,
  failed_attempt_count = failed_attempt_count + CASE WHEN code_hash = $2 THEN 0 ELSE 1 END
WHERE id = $1
  AND expires_at > clock_timestamp()
RETURNING code_hash = $2 AS is_match;`;

/**
 * Creates the functions that issue and consume verification challenges, such as the code that
 * confirms a new email address. A challenge is bound to an actor, an action, and a target; only
 * the SHA-256 hashes of its token and code are stored, in a `verification_challenge` table the
 * README defines, and every comparison uses the database's clock.
 *
 * `issue` refuses with `limit` once the actor was issued the action's `issueLimit` challenges
 * within `issueWindowSeconds`, over every target, so concurrent issues queue on a transaction
 * advisory lock. Otherwise it supersedes the binding's active challenge, commits the new one, and
 * calls `deliver` with the code. `resend` sends the active challenge a new code under the same
 * token and expiry, which stops the earlier code from working, up to the policy's `resendLimit`
 * and at most once per `resendCooldownSeconds`. `consume` uses the challenge when the code
 * matches, or counts a failed attempt, and every failure resolves to `false` alike.
 * @param postgres The database.
 * @param options Each action's policy, keyed by its action id, and the code's digits.
 * @returns The functions.
 * @example
 * import { createPostgres, createVerificationChallenges } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 * declare const sendEmail: (to: string, text: string) => Promise<void>;
 *
 * const challenges = createVerificationChallenges(postgres, {
 *   policies: {
 *     'verify-email': {
 *       validitySeconds: 600,
 *       maxFailedAttempts: 5,
 *       issueLimit: 5,
 *       issueWindowSeconds: 3_600,
 *       resendLimit: 3,
 *       resendCooldownSeconds: 60,
 *     },
 *   },
 * });
 * const binding = { actorId: '42', actionId: 'verify-email', targetId: 'ada@example.com' };
 * const issued = await challenges.issue(binding, ({ code, targetId }) =>
 *   sendEmail(targetId, `Your code is ${code}`),
 * );
 * if (issued.outcome === 'issued') {
 *   // when the user asks for another code
 *   await challenges.resend({ ...binding, challengeToken: issued.challengeToken }, ({ code }) =>
 *     sendEmail(binding.targetId, `Your new code is ${code}`),
 *   );
 *   // later, with the code the user typed
 *   const isVerified = await challenges.consume({
 *     ...binding,
 *     challengeToken: issued.challengeToken,
 *     code: '123456',
 *   });
 * }
 * @throws
 * - INVALID_VERIFICATION_POLICY: The verification challenges need at least one policy, each for an action id of 1 to 128 characters, with whole validity and window seconds of at least 1, a whole issue limit of at least 1, a whole failed-attempt limit from 1 to 32767, and, when given, a whole resend limit from 1 to 32767 and whole resend cooldown seconds of at least 1, and a whole code length from 4 to 10.
 */
export const createVerificationChallenges = (
  postgres: IPostgres,
  { policies, codeLength = DEFAULT_CODE_LENGTH }: IVerificationChallengesOptions,
): IVerificationChallenges => {
  const policyByAction = readPolicies(policies, codeLength);

  /**
   * Delivers a committed code, and turns a delivery that throws into VERIFICATION_DELIVERY_FAILED,
   * with the code and the token redacted from it and its cause.
   * @param deliver Sends the code to the actor.
   * @param delivery The code, and what it's for.
   * @param challengeToken The challenge's token, to redact.
   * @returns A promise that resolves once the code was delivered.
   * @throws
   * - VERIFICATION_DELIVERY_FAILED: The verification code couldn't be delivered.
   */
  const deliverCode = async (
    deliver: IVerificationDeliver,
    delivery: IVerificationDelivery,
    challengeToken: string,
  ): Promise<void> => {
    try {
      await deliver(delivery);
    } catch (error) {
      throw new Exception("The verification code couldn't be delivered.", {
        code: ERRORS.VERIFICATION_DELIVERY_FAILED,
        data: { challengeId: delivery.challengeId },
        cause: error,
        redact: [delivery.code, challengeToken],
      });
    }
  };

  /**
   * Locks the binding's challenge for the token until the transaction ends.
   * @param client The transaction's client.
   * @param challengeToken The challenge's token.
   * @param binding The actor, action, and target.
   * @param maxFailedAttempts The policy's failed-attempt limit.
   * @returns A promise that resolves to the challenge's id, or to undefined when it's used,
   * superseded, out of attempts, or another binding's.
   */
  const lockChallenge = async (
    client: PoolClient,
    challengeToken: string,
    { actorId, actionId, targetId }: IVerificationBinding,
    maxFailedAttempts: number,
  ): Promise<string | undefined> => {
    const { rows } = await client.query<{ id: string }>(CHALLENGE_LOCK_QUERY, [
      hashValue(challengeToken),
      actorId,
      actionId,
      targetId,
      maxFailedAttempts,
    ]);
    return rows[0]?.id;
  };

  /**
   * Issues a challenge for a binding and delivers its code once it's committed, unless the actor
   * reached the action's issue limit. Issuing again for the same binding supersedes the active
   * challenge. When delivery fails, the challenge stays committed and counts toward the limit, but
   * its token is never returned.
   * @param binding The actor, action, and target.
   * @param deliver Sends the code to the actor.
   * @returns A promise that resolves to the token and when it expires, or to when the actor may be
   * issued a challenge again.
   * @throws
   * - INVALID_VERIFICATION_INPUT: The verification input needs an actor id of 1 to 256 characters, an action id with a policy, a target id of 1 to 256 characters, and, to issue or resend, a delivery function, and to resend, a policy with a resend limit.
   * - VERIFICATION_DELIVERY_FAILED: The verification code couldn't be delivered.
   * - TRANSACTION_OUTCOME_UNKNOWN: The connection was lost during COMMIT, so the transaction may or may not have committed.
   */
  const issue = async (
    binding: IVerificationBinding,
    deliver: IVerificationDeliver,
  ): Promise<IVerificationIssue> => {
    const policy = readBindingPolicy(policyByAction, binding);
    if (typeof deliver !== 'function') {
      throw invalidInput();
    }
    const { actorId, actionId, targetId } = binding;
    const challengeToken = generateRandomBytes(TOKEN_BYTE_LENGTH);
    const code = generateRandomDigits(codeLength);
    const decision = await postgres.transaction(async (client): Promise<IIssueDecision> => {
      await lockTransaction(client, createIssueLockKey(actorId, actionId));
      // the issue that must leave the window before the actor is under the limit again; the lock
      // is held, so clock_timestamp() is after any wait for it
      const { rows: limited } = await client.query<{ retry_at: string }>(
        `SELECT created_at + make_interval(secs => $3) AS retry_at
        FROM verification_challenge
        WHERE actor_id = $1
          AND action_id = $2
          AND created_at > clock_timestamp() - make_interval(secs => $3)
        ORDER BY created_at DESC
        OFFSET $4
        LIMIT 1;`,
        [actorId, actionId, policy.issueWindowSeconds, policy.issueLimit - 1],
      );
      if (limited[0] !== undefined) {
        return { outcome: 'limit', retryAt: limited[0].retry_at };
      }
      await client.query(
        `UPDATE verification_challenge
        SET superseded_at = clock_timestamp()
        WHERE actor_id = $1
          AND action_id = $2
          AND target_id = $3
          AND used_at IS NULL
          AND superseded_at IS NULL;`,
        [actorId, actionId, targetId],
      );
      const { rows: inserted } = await client.query<{ id: string; expires_at: string }>(
        `WITH issue_time AS (
          SELECT clock_timestamp() AS issued_at
        )
        INSERT INTO verification_challenge
          (actor_id, action_id, target_id, token_hash, code_hash, expires_at, created_at)
        SELECT $1, $2, $3, $4, $5, issue_time.issued_at + make_interval(secs => $6), issue_time.issued_at
        FROM issue_time
        RETURNING id, expires_at;`,
        [
          actorId,
          actionId,
          targetId,
          hashValue(challengeToken),
          hashChallengeCode(challengeToken, code),
          policy.validitySeconds,
        ],
      );
      // RETURNING gives the one inserted row
      const [{ id, expires_at: expiresAt }] = inserted as [{ id: string; expires_at: string }];
      return { outcome: 'issued', challengeId: id, expiresAt };
    });
    if (decision.outcome === 'limit') {
      return decision;
    }
    const { challengeId, expiresAt } = decision;
    await deliverCode(
      deliver,
      {
        code,
        challengeId,
        deliveryId: `${challengeId}:0`,
        actorId,
        actionId,
        targetId,
        expiresAt,
        validitySeconds: policy.validitySeconds,
        remainingSeconds: policy.validitySeconds,
      },
      challengeToken,
    );
    return { outcome: 'issued', challengeToken, expiresAt };
  };

  /**
   * Sends a new code for a binding's active challenge, keeping its token, its expiry, and its
   * failed attempts, and delivers it once it's committed, which stops the earlier code from
   * working. A token without the expected shape resolves to `invalid` without touching the
   * database, and so does a challenge that's used, superseded, expired, or out of attempts, or
   * another binding's token. When delivery fails, the resend still counts.
   * @param request The binding, and the challenge's token.
   * @param deliver Sends the new code to the actor.
   * @returns A promise that resolves to `resent` and the unchanged expiry, to `cooldown` and when
   * the challenge may be resent, to `limit` once it was resent the policy's `resendLimit` times, or
   * to `invalid`.
   * @throws
   * - INVALID_VERIFICATION_INPUT: The verification input needs an actor id of 1 to 256 characters, an action id with a policy, a target id of 1 to 256 characters, and, to issue or resend, a delivery function, and to resend, a policy with a resend limit.
   * - VERIFICATION_DELIVERY_FAILED: The verification code couldn't be delivered.
   * - TRANSACTION_OUTCOME_UNKNOWN: The connection was lost during COMMIT, so the transaction may or may not have committed.
   */
  const resend = async (
    { challengeToken, ...binding }: IVerificationResendRequest,
    deliver: IVerificationDeliver,
  ): Promise<IVerificationResend> => {
    const policy = readBindingPolicy(policyByAction, binding);
    const { resendLimit, resendCooldownSeconds = 0 } = policy;
    if (typeof deliver !== 'function' || resendLimit === undefined) {
      throw invalidInput();
    }
    if (!isChallengeTokenValid(challengeToken)) {
      return { outcome: 'invalid' };
    }
    const { actorId, actionId, targetId } = binding;
    const code = generateRandomDigits(codeLength);
    const decision = await postgres.transaction(async (client): Promise<IResendDecision> => {
      const challengeId = await lockChallenge(
        client,
        challengeToken,
        binding,
        policy.maxFailedAttempts,
      );
      if (challengeId === undefined) {
        return { outcome: 'invalid' };
      }
      const { rows: states } = await client.query<{
        resend_count: number;
        is_expired: boolean;
        cooldown_ends_at: string;
        is_cooling_down: boolean;
      }>(RESEND_STATE_QUERY, [challengeId, resendCooldownSeconds]);
      // the lock keeps the one row in place
      const [state] = states as [
        {
          resend_count: number;
          is_expired: boolean;
          cooldown_ends_at: string;
          is_cooling_down: boolean;
        },
      ];
      if (state.is_expired) {
        return { outcome: 'invalid' };
      }
      if (state.resend_count >= resendLimit) {
        return { outcome: 'limit' };
      }
      if (state.is_cooling_down) {
        return { outcome: 'cooldown', retryAt: state.cooldown_ends_at };
      }
      const { rows: updated } = await client.query<{
        resend_count: number;
        expires_at: string;
        remaining_seconds: number;
      }>(RESEND_UPDATE_QUERY, [challengeId, hashChallengeCode(challengeToken, code)]);
      // RETURNING gives the one updated row, which the lock keeps in place
      const [row] = updated as [
        { resend_count: number; expires_at: string; remaining_seconds: number },
      ];
      return {
        outcome: 'resent',
        challengeId,
        resendCount: row.resend_count,
        expiresAt: row.expires_at,
        remainingSeconds: row.remaining_seconds,
      };
    });
    if (decision.outcome !== 'resent') {
      return decision;
    }
    const { challengeId, resendCount, expiresAt, remainingSeconds } = decision;
    await deliverCode(
      deliver,
      {
        code,
        challengeId,
        deliveryId: `${challengeId}:${String(resendCount)}`,
        actorId,
        actionId,
        targetId,
        expiresAt,
        validitySeconds: policy.validitySeconds,
        remainingSeconds,
      },
      challengeToken,
    );
    return { outcome: 'resent', expiresAt };
  };

  /**
   * Uses a challenge when its code matches, or counts one failed attempt against it. A token or
   * code without the expected shape resolves to false without touching the database, and so does
   * every other failure: a used, superseded, or expired challenge, one out of attempts, a wrong
   * code, or another binding's token. Expiry is judged on the database's clock once the
   * challenge's row is locked, so an attempt that waited for another call past the expiry fails
   * without writing.
   * @param attempt The binding, the challenge's token, and the code.
   * @returns A promise that resolves to whether the code matched.
   * @throws
   * - INVALID_VERIFICATION_INPUT: The verification input needs an actor id of 1 to 256 characters, an action id with a policy, a target id of 1 to 256 characters, and, to issue or resend, a delivery function, and to resend, a policy with a resend limit.
   * - TRANSACTION_OUTCOME_UNKNOWN: The connection was lost during COMMIT, so the transaction may or may not have committed.
   */
  const consume = async ({
    challengeToken,
    code,
    ...binding
  }: IVerificationAttempt): Promise<boolean> => {
    const policy = readBindingPolicy(policyByAction, binding);
    if (!isChallengeTokenValid(challengeToken) || !isCodeValid(code, codeLength)) {
      return false;
    }
    return postgres.transaction(async (client): Promise<boolean> => {
      const challengeId = await lockChallenge(
        client,
        challengeToken,
        binding,
        policy.maxFailedAttempts,
      );
      if (challengeId === undefined) {
        return false;
      }
      const { rows } = await client.query<{ is_match: boolean }>(CONSUME_UPDATE_QUERY, [
        challengeId,
        hashChallengeCode(challengeToken, code),
      ]);
      // no row when the challenge expired
      return rows[0]?.is_match === true;
    });
  };

  return { issue, resend, consume };
};
