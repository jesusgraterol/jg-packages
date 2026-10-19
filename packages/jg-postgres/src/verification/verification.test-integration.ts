// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { hashValue } from 'jg-crypto';
import { extractMessage } from 'jg-exception';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestPostgres } from '../test-utils/database.js';

import type {
  IVerificationBinding,
  IVerificationChallenges,
  IVerificationDelivery,
  IVerificationPolicy,
} from './types.js';
import { hashChallengeCode } from './utilities.js';
import { createVerificationChallenges } from './verification.js';

// a challenge's row, as the README's table stores it
type IChallengeRow = {
  id: string;
  actor_id: string;
  action_id: string;
  target_id: string;
  token_hash: string;
  code_hash: string;
  failed_attempt_count: number;
  expires_at: string;
  used_at: string | null;
  superseded_at: string | null;
  created_at: string;
};

// the policy every action starts from: three codes an hour, three wrong codes each
const POLICY: IVerificationPolicy = {
  validitySeconds: 600,
  maxFailedAttempts: 3,
  issueLimit: 3,
  issueWindowSeconds: 3_600,
};

/**
 * Reads the SQL blocks of the README's "Verification challenges" section, so the tests run the
 * schema and the pruning query the README documents.
 * @returns The table's DDL and the pruning query.
 */
const readDocumentedSql = (): { ddl: string; prune: string } => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const section = readme.slice(readme.indexOf('### Verification challenges'));
  const [ddl, prune] = [...section.matchAll(/```sql\n([\s\S]*?)```/g)].map(
    (match) => match[1] ?? '',
  );
  if (ddl === undefined || prune === undefined) {
    throw new Error('The README lost its verification SQL.');
  }
  return { ddl, prune };
};

let postgres: IPostgres;
let challenges: IVerificationChallenges;

/**
 * Builds a binding for an actor no other test uses.
 * @param binding What to change.
 * @returns The binding.
 */
const createBinding = (binding: Partial<IVerificationBinding> = {}): IVerificationBinding => ({
  actorId: `actor-${randomUUID()}`,
  actionId: 'verify-email',
  targetId: 'ada@example.com',
  ...binding,
});

/**
 * Issues a challenge, and gives its token with the code it delivered.
 * @param binding The binding.
 * @returns A promise that resolves to the token and the code.
 */
const issueWithCode = async (
  binding: IVerificationBinding,
): Promise<{ challengeToken: string; code: string }> => {
  let code = '';
  const issued = await challenges.issue(binding, (delivery) => {
    ({ code } = delivery);
  });
  if (issued.outcome !== 'issued') {
    throw new Error('The challenge was not issued.');
  }
  return { challengeToken: issued.challengeToken, code };
};

/**
 * Gives a code of the same length that isn't the right one.
 * @param code The right code.
 * @returns Another code.
 */
const toWrongCode = (code: string): string =>
  code.startsWith('0') ? `1${code.slice(1)}` : `0${code.slice(1)}`;

/**
 * Reads an actor's challenges, oldest first.
 * @param actorId The actor.
 * @returns A promise that resolves to the rows.
 */
const readChallenges = (actorId: string): Promise<IChallengeRow[]> =>
  postgres.query<IChallengeRow>(
    `SELECT id, actor_id, action_id, target_id, token_hash, code_hash, failed_attempt_count,
      expires_at, used_at, superseded_at, created_at
    FROM verification_challenge
    WHERE actor_id = $1
    ORDER BY id;`,
    [actorId],
  );

/**
 * Records a past challenge, as an earlier issue would have, for a target no other row uses.
 * @param binding The actor and the action.
 * @param secondsAgo How long ago it was issued.
 */
const insertPastChallenge = async (
  binding: IVerificationBinding,
  secondsAgo: number,
): Promise<void> => {
  await postgres.query(
    `INSERT INTO verification_challenge
      (actor_id, action_id, target_id, token_hash, code_hash, expires_at, created_at)
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      clock_timestamp() - make_interval(secs => $6) + interval '10 minutes',
      clock_timestamp() - make_interval(secs => $6)
    );`,
    [
      binding.actorId,
      binding.actionId,
      `target-${randomUUID()}`,
      hashValue(randomUUID()),
      hashValue(randomUUID()),
      secondsAgo,
    ],
  );
};

beforeAll(async () => {
  postgres = connectTestPostgres({ max: 8 });
  await postgres.query('DROP TABLE IF EXISTS verification_challenge;');
  await postgres.query(readDocumentedSql().ddl);
  challenges = createVerificationChallenges(postgres, {
    policies: {
      'verify-email': POLICY,
      'verify-phone': POLICY,
      'verify-burst': { ...POLICY, issueLimit: 8 },
      'verify-once': { ...POLICY, issueLimit: 1 },
    },
  });
});

afterAll(async () => {
  await postgres.query('DROP TABLE verification_challenge;');
  await postgres.close();
});

describe('issue', () => {
  test('issues a token and a code of the expected shapes, storing only their hashes, expiring on the database clock', async () => {
    const binding = createBinding();
    const deliveries: IVerificationDelivery[] = [];

    const issued = await challenges.issue(binding, (delivery) => {
      deliveries.push(delivery);
    });
    const [row] = await readChallenges(binding.actorId);

    expect(issued.outcome).toBe('issued');
    if (issued.outcome !== 'issued' || row === undefined || deliveries[0] === undefined) {
      throw new Error('The challenge was not issued.');
    }
    const { code } = deliveries[0];
    expect(issued.challengeToken).toMatch(/^[\w-]{43}$/);
    expect(code).toMatch(/^\d{6}$/);
    expect(deliveries).toStrictEqual([
      {
        code,
        challengeId: row.id,
        ...binding,
        expiresAt: row.expires_at,
        validitySeconds: 600,
      },
    ]);
    expect(issued.expiresAt).toBe(row.expires_at);
    expect(Date.parse(row.expires_at) - Date.parse(row.created_at)).toBe(600_000);
    expect(row.token_hash).toBe(hashValue(issued.challengeToken));
    expect(row.code_hash).toBe(hashChallengeCode(issued.challengeToken, code));
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(issued.challengeToken);
    expect(row).toMatchObject({ failed_attempt_count: 0, used_at: null, superseded_at: null });
  });

  test('delivers once the challenge is committed, so another connection sees it', async () => {
    const binding = createBinding();
    let visibleRows: unknown[] = [];

    await challenges.issue(binding, async ({ challengeId }) => {
      visibleRows = await postgres.query(
        'SELECT id FROM verification_challenge WHERE id = $1 AND used_at IS NULL;',
        [challengeId],
      );
    });

    expect(visibleRows).toHaveLength(1);
  });

  test('issues up to the limit, superseding each time, then refuses with retryAt, superseding and delivering nothing', async () => {
    const binding = createBinding();
    const deliveries: IVerificationDelivery[] = [];
    const deliver = (delivery: IVerificationDelivery): void => {
      deliveries.push(delivery);
    };
    for (let index = 0; index < 3; index += 1) {
      expect((await challenges.issue(binding, deliver)).outcome).toBe('issued');
    }

    const refused = await challenges.issue(binding, deliver);
    const rows = await readChallenges(binding.actorId);

    expect(rows).toHaveLength(3);
    expect(refused).toStrictEqual({
      outcome: 'limit',
      retryAt: new Date(Date.parse(rows[0]?.created_at ?? '') + 3_600_000).toISOString(),
    });
    expect(deliveries).toHaveLength(3);
    expect(rows.map((row) => row.superseded_at === null)).toStrictEqual([false, false, true]);
  });

  test('counts only the issues within the window', async () => {
    const binding = createBinding();
    for (const secondsAgo of [7_200, 7_200, 7_200, 60]) {
      await insertPastChallenge(binding, secondsAgo);
    }

    expect((await issueWithCode(binding)).code).toMatch(/^\d{6}$/);
    expect((await issueWithCode({ ...binding, targetId: 'other' })).code).toMatch(/^\d{6}$/);
    expect(await challenges.issue(binding, () => undefined)).toMatchObject({ outcome: 'limit' });
  });

  test('applies one limit over every target, apart for each action, superseding per target', async () => {
    const binding = createBinding();
    for (const targetId of ['a@example.com', 'b@example.com', 'c@example.com']) {
      await issueWithCode({ ...binding, targetId });
    }

    expect(
      await challenges.issue({ ...binding, targetId: 'd@example.com' }, () => undefined),
    ).toMatchObject({ outcome: 'limit' });
    expect(
      (await challenges.issue({ ...binding, actionId: 'verify-phone' }, () => undefined)).outcome,
    ).toBe('issued');
    const rows = await readChallenges(binding.actorId);
    expect(rows.map((row) => [row.action_id, row.target_id, row.superseded_at])).toStrictEqual([
      ['verify-email', 'a@example.com', null],
      ['verify-email', 'b@example.com', null],
      ['verify-email', 'c@example.com', null],
      ['verify-phone', 'ada@example.com', null],
    ]);
  });

  test('leaves exactly one active challenge after five concurrent issues for a binding', async () => {
    const binding = createBinding({ actionId: 'verify-burst' });

    const issues = await Promise.all(
      Array.from({ length: 5 }, () => challenges.issue(binding, () => undefined)),
    );
    const rows = await readChallenges(binding.actorId);

    expect(issues.map((issued) => issued.outcome)).toStrictEqual(Array(5).fill('issued'));
    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row.superseded_at === null)).toHaveLength(1);
  });

  test('throws a redacted VERIFICATION_DELIVERY_FAILED when delivery fails, and still counts the challenge', async () => {
    const binding = createBinding({ actionId: 'verify-once' });
    let code = '';
    let error: unknown;

    try {
      await challenges.issue(binding, (delivery) => {
        ({ code } = delivery);
        throw new Error(`The mail server refused the message with ${delivery.code}.`);
      });
    } catch (caught) {
      error = caught;
    }
    const [row] = await readChallenges(binding.actorId);

    expect(error).toMatchObject({
      code: ERRORS.VERIFICATION_DELIVERY_FAILED,
      message: "The verification code couldn't be delivered.",
      data: { challengeId: row?.id },
    });
    expect(extractMessage(error)).toContain('[redacted]');
    expect(extractMessage(error)).not.toContain(code);
    expect(row).toMatchObject({ used_at: null, superseded_at: null });
    expect(await challenges.issue(binding, () => undefined)).toMatchObject({ outcome: 'limit' });
  });
});

describe('consume', () => {
  test('uses the challenge once for the right code, then resolves to false', async () => {
    const binding = createBinding();
    const { challengeToken, code } = await issueWithCode(binding);

    expect(await challenges.consume({ ...binding, challengeToken, code })).toBe(true);
    expect(await challenges.consume({ ...binding, challengeToken, code })).toBe(false);
    const [row] = await readChallenges(binding.actorId);
    expect(row?.used_at).not.toBeNull();
    expect(row?.failed_attempt_count).toBe(0);
  });

  test('gives true to only one of two concurrent attempts with the right code', async () => {
    const binding = createBinding();
    const { challengeToken, code } = await issueWithCode(binding);

    const results = await Promise.all([
      challenges.consume({ ...binding, challengeToken, code }),
      challenges.consume({ ...binding, challengeToken, code }),
    ]);

    expect(results.sort()).toStrictEqual([false, true]);
  });

  test('stops accepting codes after maxFailedAttempts wrong ones, by the current policy', async () => {
    const binding = createBinding();
    const { challengeToken, code } = await issueWithCode(binding);
    const wrongCode = toWrongCode(code);
    for (let index = 0; index < 3; index += 1) {
      expect(await challenges.consume({ ...binding, challengeToken, code: wrongCode })).toBe(false);
    }

    expect(await challenges.consume({ ...binding, challengeToken, code })).toBe(false);
    expect(await readChallenges(binding.actorId)).toMatchObject([
      { failed_attempt_count: 3, used_at: null },
    ]);
    const relaxed = createVerificationChallenges(postgres, {
      policies: { 'verify-email': { ...POLICY, maxFailedAttempts: 4 } },
    });
    expect(await relaxed.consume({ ...binding, challengeToken, code })).toBe(true);
  });

  test('resolves to false without counting for an expired, a superseded, or another binding challenge', async () => {
    const expired = createBinding();
    const expiredChallenge = await issueWithCode(expired);
    await postgres.query(
      `UPDATE verification_challenge
      SET created_at = clock_timestamp() - interval '2 seconds',
        expires_at = clock_timestamp() - interval '1 second'
      WHERE actor_id = $1;`,
      [expired.actorId],
    );
    const superseded = createBinding();
    const supersededChallenge = await issueWithCode(superseded);
    await issueWithCode(superseded);
    const bound = createBinding();
    const boundChallenge = await issueWithCode(bound);

    expect(await challenges.consume({ ...expired, ...expiredChallenge })).toBe(false);
    expect(await challenges.consume({ ...superseded, ...supersededChallenge })).toBe(false);
    for (const mismatch of [
      { actorId: `actor-${randomUUID()}` },
      { actionId: 'verify-phone' },
      { targetId: 'eve@example.com' },
    ]) {
      expect(await challenges.consume({ ...bound, ...boundChallenge, ...mismatch })).toBe(false);
    }
    for (const actorId of [expired.actorId, superseded.actorId, bound.actorId]) {
      for (const row of await readChallenges(actorId)) {
        expect(row).toMatchObject({ failed_attempt_count: 0, used_at: null });
      }
    }
    expect(await challenges.consume({ ...bound, ...boundChallenge })).toBe(true);
  });

  test('makes no write for a token or code of the wrong shape', async () => {
    const binding = createBinding();
    const { challengeToken, code } = await issueWithCode(binding);
    const [before] = await readChallenges(binding.actorId);

    expect(await challenges.consume({ ...binding, challengeToken, code: code.slice(1) })).toBe(
      false,
    );
    expect(await challenges.consume({ ...binding, challengeToken, code: `${code}0` })).toBe(false);
    expect(
      await challenges.consume({ ...binding, challengeToken: `${challengeToken}=`, code }),
    ).toBe(false);

    expect(await readChallenges(binding.actorId)).toStrictEqual([before]);
  });
});

describe('the documented pruning query', () => {
  test('deletes, oldest first, at most a batch of the rows older than the age', async () => {
    // the query prunes the whole table, so the rows the other tests left would count
    await postgres.query('TRUNCATE verification_challenge;');
    const binding = createBinding();
    for (const secondsAgo of [9_000, 8_000, 7_000, 60]) {
      await insertPastChallenge(binding, secondsAgo);
    }
    const { prune } = readDocumentedSql();
    const countOlderThan = async (seconds: number): Promise<number> => {
      const [{ challenge_count }] = (await postgres.query<{ challenge_count: number }>(
        `SELECT count(*)::integer AS challenge_count FROM verification_challenge
        WHERE created_at < clock_timestamp() - make_interval(secs => $1);`,
        [seconds],
      )) as [{ challenge_count: number }];
      return challenge_count;
    };

    const first = await postgres.pool.query(prune, [3_600, 2]);

    expect(first.rowCount).toBe(2);
    expect(await countOlderThan(7_500)).toBe(0);
    expect(await countOlderThan(0)).toBe(2);

    const second = await postgres.pool.query(prune, [3_600, 2]);
    const third = await postgres.pool.query(prune, [3_600, 2]);

    expect(second.rowCount).toBe(1);
    expect(third.rowCount).toBe(0);
    expect(await countOlderThan(0)).toBe(1);
  });
});
