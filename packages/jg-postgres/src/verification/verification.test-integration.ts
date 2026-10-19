// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { hashValue } from 'jg-crypto';
import { extractMessage } from 'jg-exception';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { deleteExpiredInBatches } from '../retention/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';

import type {
  IVerificationBinding,
  IVerificationChallenges,
  IVerificationDelivery,
  IVerificationPolicy,
  IVerificationResend,
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
  resend_count: number;
  expires_at: string;
  used_at: string | null;
  superseded_at: string | null;
  resent_at: string | null;
  created_at: string;
};

// the policy every action starts from: three codes an hour, three wrong codes each
const POLICY: IVerificationPolicy = {
  validitySeconds: 600,
  maxFailedAttempts: 3,
  issueLimit: 3,
  issueWindowSeconds: 3_600,
};

// the table jg-postgres 0.3.0's README defined, which the README's migration upgrades
const DDL_0_3_0 = `
CREATE TABLE verification_challenge (
  id bigint GENERATED ALWAYS AS IDENTITY,
  actor_id varchar(256) NOT NULL,
  action_id varchar(128) NOT NULL,
  target_id varchar(256) NOT NULL,
  token_hash text NOT NULL,
  code_hash text NOT NULL,
  failed_attempt_count smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  superseded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_vc__id PRIMARY KEY (id),
  CONSTRAINT uq_vc__token_hash UNIQUE (token_hash),
  CONSTRAINT chk_vc__actor_id_non_empty CHECK (actor_id <> ''),
  CONSTRAINT chk_vc__action_id_non_empty CHECK (action_id <> ''),
  CONSTRAINT chk_vc__target_id_non_empty CHECK (target_id <> ''),
  CONSTRAINT chk_vc__token_hash_sha256 CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_vc__code_hash_sha256 CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_vc__failed_attempt_count_non_negative CHECK (failed_attempt_count >= 0),
  CONSTRAINT chk_vc__expires_at_chronological CHECK (expires_at > created_at),
  CONSTRAINT chk_vc__used_at_superseded_at_mutually_exclusive
    CHECK (used_at IS NULL OR superseded_at IS NULL)
);
CREATE UNIQUE INDEX uidx_vc__actor_id_action_id_target_id_active
  ON verification_challenge (actor_id, action_id, target_id)
  WHERE used_at IS NULL AND superseded_at IS NULL;
CREATE INDEX idx_vc__actor_id_action_id_created_at
  ON verification_challenge (actor_id, action_id, created_at);
CREATE INDEX idx_vc__created_at ON verification_challenge (created_at);
`;

/**
 * Reads the SQL blocks of the README's "Verification challenges" section, so the tests run the
 * schema and the migration the README documents.
 * @returns The table's DDL, and the migration from 0.3.0's table.
 */
const readDocumentedSql = (): { ddl: string; migration: string } => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const section = readme.slice(
    readme.indexOf('### Verification challenges'),
    readme.indexOf('### Database summaries'),
  );
  const [ddl, migration] = [...section.matchAll(/```sql\n([\s\S]*?)```/g)].map(
    (match) => match[1] ?? '',
  );
  if (ddl === undefined || migration === undefined) {
    throw new Error('The README lost its verification SQL.');
  }
  return { ddl, migration };
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
 * Resends a challenge, and gives the outcome with the deliveries it made.
 * @param binding The binding.
 * @param challengeToken The challenge's token.
 * @returns A promise that resolves to the outcome and the deliveries.
 */
const resendWithDeliveries = async (
  binding: IVerificationBinding,
  challengeToken: string,
): Promise<{ resent: IVerificationResend; deliveries: IVerificationDelivery[] }> => {
  const deliveries: IVerificationDelivery[] = [];
  const resent = await challenges.resend({ ...binding, challengeToken }, (delivery) => {
    deliveries.push(delivery);
  });
  return { resent, deliveries };
};

/**
 * Reads an actor's challenges, oldest first.
 * @param actorId The actor.
 * @returns A promise that resolves to the rows.
 */
const readChallenges = (actorId: string): Promise<IChallengeRow[]> =>
  postgres.query<IChallengeRow>(
    `SELECT id, actor_id, action_id, target_id, token_hash, code_hash, failed_attempt_count,
      resend_count, expires_at, used_at, superseded_at, resent_at, created_at
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
      'verify-resend': { ...POLICY, issueLimit: 2, resendLimit: 2 },
      'verify-cooldown': { ...POLICY, resendLimit: 5, resendCooldownSeconds: 60 },
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
        deliveryId: `${row.id}:0`,
        ...binding,
        expiresAt: row.expires_at,
        validitySeconds: 600,
        remainingSeconds: 600,
      },
    ]);
    expect(issued.expiresAt).toBe(row.expires_at);
    expect(Date.parse(row.expires_at) - Date.parse(row.created_at)).toBe(600_000);
    expect(row.token_hash).toBe(hashValue(issued.challengeToken));
    expect(row.code_hash).toBe(hashChallengeCode(issued.challengeToken, code));
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(issued.challengeToken);
    expect(row).toMatchObject({
      failed_attempt_count: 0,
      resend_count: 0,
      used_at: null,
      superseded_at: null,
      resent_at: null,
    });
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

describe('resend', () => {
  test('sends a new code under the same token and expiry, storing its hash and counting the resend', async () => {
    const binding = createBinding({ actionId: 'verify-resend' });
    const { challengeToken, code } = await issueWithCode(binding);
    const [before] = await readChallenges(binding.actorId);

    const { resent, deliveries } = await resendWithDeliveries(binding, challengeToken);
    const [after] = await readChallenges(binding.actorId);

    if (before === undefined || after === undefined || deliveries[0] === undefined) {
      throw new Error('The challenge was not resent.');
    }
    const { code: newCode, remainingSeconds } = deliveries[0];
    expect(resent).toStrictEqual({ outcome: 'resent', expiresAt: before.expires_at });
    expect(deliveries).toStrictEqual([
      {
        code: newCode,
        challengeId: before.id,
        deliveryId: `${before.id}:1`,
        ...binding,
        expiresAt: before.expires_at,
        validitySeconds: 600,
        remainingSeconds,
      },
    ]);
    expect(newCode).toMatch(/^\d{6}$/);
    expect(remainingSeconds).toBeGreaterThan(590);
    expect(remainingSeconds).toBeLessThanOrEqual(600);
    expect(after).toMatchObject({
      id: before.id,
      token_hash: before.token_hash,
      expires_at: before.expires_at,
      code_hash: hashChallengeCode(challengeToken, newCode),
      resend_count: 1,
      failed_attempt_count: 0,
    });
    expect(after.resent_at).not.toBeNull();
    expect(Date.parse(after.resent_at ?? '')).toBeGreaterThanOrEqual(Date.parse(after.created_at));
    // the earlier code stopped working, and the new one works
    if (code !== newCode) {
      expect(await challenges.consume({ ...binding, challengeToken, code })).toBe(false);
    }
    expect(await challenges.consume({ ...binding, challengeToken, code: newCode })).toBe(true);
  });

  test('numbers each resend in its deliveryId', async () => {
    const binding = createBinding({ actionId: 'verify-resend' });
    const { challengeToken } = await issueWithCode(binding);

    const first = await resendWithDeliveries(binding, challengeToken);
    const second = await resendWithDeliveries(binding, challengeToken);
    const [row] = await readChallenges(binding.actorId);

    expect(first.deliveries.map(({ deliveryId }) => deliveryId)).toStrictEqual([`${row?.id}:1`]);
    expect(second.deliveries.map(({ deliveryId }) => deliveryId)).toStrictEqual([`${row?.id}:2`]);
  });

  test('carries the failed attempts over to the new code, and resolves to invalid once they run out', async () => {
    const binding = createBinding({ actionId: 'verify-resend' });
    const { challengeToken, code } = await issueWithCode(binding);
    for (let index = 0; index < 2; index += 1) {
      await challenges.consume({ ...binding, challengeToken, code: toWrongCode(code) });
    }

    const { deliveries } = await resendWithDeliveries(binding, challengeToken);
    const newCode = deliveries[0]?.code ?? '';
    expect(await readChallenges(binding.actorId)).toMatchObject([{ failed_attempt_count: 2 }]);
    await challenges.consume({ ...binding, challengeToken, code: toWrongCode(newCode) });

    expect(await resendWithDeliveries(binding, challengeToken)).toStrictEqual({
      resent: { outcome: 'invalid' },
      deliveries: [],
    });
    expect(await challenges.consume({ ...binding, challengeToken, code: newCode })).toBe(false);
  });

  test('never counts a resend toward the issue limit', async () => {
    const binding = createBinding({ actionId: 'verify-resend' });
    const { challengeToken } = await issueWithCode(binding);
    await resendWithDeliveries(binding, challengeToken);
    await resendWithDeliveries(binding, challengeToken);

    expect((await challenges.issue(binding, () => undefined)).outcome).toBe('issued');
    expect(await challenges.issue(binding, () => undefined)).toMatchObject({ outcome: 'limit' });
  });

  test('refuses with limit after resendLimit resends, writing and delivering nothing', async () => {
    const binding = createBinding({ actionId: 'verify-resend' });
    const { challengeToken } = await issueWithCode(binding);
    await resendWithDeliveries(binding, challengeToken);
    await resendWithDeliveries(binding, challengeToken);
    const before = await readChallenges(binding.actorId);

    expect(await resendWithDeliveries(binding, challengeToken)).toStrictEqual({
      resent: { outcome: 'limit' },
      deliveries: [],
    });
    expect(await readChallenges(binding.actorId)).toStrictEqual(before);
  });

  test('refuses with cooldown until resendCooldownSeconds after the issue or the last resend, writing and delivering nothing', async () => {
    const binding = createBinding({ actionId: 'verify-cooldown' });
    const { challengeToken } = await issueWithCode(binding);
    const [issuedRow] = await readChallenges(binding.actorId);

    expect(await resendWithDeliveries(binding, challengeToken)).toStrictEqual({
      resent: {
        outcome: 'cooldown',
        retryAt: new Date(Date.parse(issuedRow?.created_at ?? '') + 60_000).toISOString(),
      },
      deliveries: [],
    });
    expect(await readChallenges(binding.actorId)).toStrictEqual([issuedRow]);

    // a minute later, as far as the challenge can tell
    await postgres.query(
      `UPDATE verification_challenge
      SET created_at = created_at - interval '61 seconds'
      WHERE actor_id = $1;`,
      [binding.actorId],
    );
    expect((await resendWithDeliveries(binding, challengeToken)).resent.outcome).toBe('resent');
    const [resentRow] = await readChallenges(binding.actorId);

    expect(await resendWithDeliveries(binding, challengeToken)).toStrictEqual({
      resent: {
        outcome: 'cooldown',
        retryAt: new Date(Date.parse(resentRow?.resent_at ?? '') + 60_000).toISOString(),
      },
      deliveries: [],
    });
    expect(await readChallenges(binding.actorId)).toStrictEqual([resentRow]);
  });

  test('resolves to invalid for a used, superseded, expired, or exhausted challenge, or another binding, writing and delivering nothing', async () => {
    const used = createBinding({ actionId: 'verify-resend' });
    const usedChallenge = await issueWithCode(used);
    await challenges.consume({ ...used, ...usedChallenge });
    const superseded = createBinding({ actionId: 'verify-resend' });
    const supersededChallenge = await issueWithCode(superseded);
    await issueWithCode(superseded);
    const expired = createBinding({ actionId: 'verify-resend' });
    const expiredChallenge = await issueWithCode(expired);
    await postgres.query(
      `UPDATE verification_challenge
      SET created_at = clock_timestamp() - interval '2 seconds',
        expires_at = clock_timestamp() - interval '1 second'
      WHERE actor_id = $1;`,
      [expired.actorId],
    );
    const exhausted = createBinding({ actionId: 'verify-resend' });
    const exhaustedChallenge = await issueWithCode(exhausted);
    await postgres.query(
      'UPDATE verification_challenge SET failed_attempt_count = 3 WHERE actor_id = $1;',
      [exhausted.actorId],
    );
    const bound = createBinding({ actionId: 'verify-resend' });
    const boundChallenge = await issueWithCode(bound);
    const actorIds = [used, superseded, expired, exhausted, bound].map(({ actorId }) => actorId);
    const before = await Promise.all(actorIds.map((actorId) => readChallenges(actorId)));

    for (const [binding, { challengeToken }] of [
      [used, usedChallenge],
      [superseded, supersededChallenge],
      [expired, expiredChallenge],
      [exhausted, exhaustedChallenge],
      [{ ...bound, actorId: `actor-${randomUUID()}` }, boundChallenge],
      [{ ...bound, targetId: 'eve@example.com' }, boundChallenge],
    ] as const) {
      expect(await resendWithDeliveries(binding, challengeToken)).toStrictEqual({
        resent: { outcome: 'invalid' },
        deliveries: [],
      });
    }
    expect(await Promise.all(actorIds.map((actorId) => readChallenges(actorId)))).toStrictEqual(
      before,
    );
  });

  test('lets exactly resendLimit of six concurrent resends through', async () => {
    const binding = createBinding({ actionId: 'verify-resend' });
    const { challengeToken } = await issueWithCode(binding);
    const deliveries: IVerificationDelivery[] = [];

    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () =>
        challenges.resend({ ...binding, challengeToken }, (delivery) => {
          deliveries.push(delivery);
        }),
      ),
    );
    const [row] = await readChallenges(binding.actorId);

    expect(outcomes.map(({ outcome }) => outcome).sort()).toStrictEqual([
      'limit',
      'limit',
      'limit',
      'limit',
      'resent',
      'resent',
    ]);
    expect(row?.resend_count).toBe(2);
    expect(deliveries.map(({ deliveryId }) => deliveryId).sort()).toStrictEqual([
      `${row?.id}:1`,
      `${row?.id}:2`,
    ]);
    expect(row?.code_hash).toBe(
      hashChallengeCode(
        challengeToken,
        deliveries.find(({ deliveryId }) => deliveryId === `${row?.id}:2`)?.code ?? '',
      ),
    );
  });

  test('delivers once the resend is committed, so another connection sees it', async () => {
    const binding = createBinding({ actionId: 'verify-resend' });
    const { challengeToken } = await issueWithCode(binding);
    let visibleRows: unknown[] = [];

    await challenges.resend({ ...binding, challengeToken }, async ({ challengeId }) => {
      visibleRows = await postgres.query(
        'SELECT id FROM verification_challenge WHERE id = $1 AND resend_count = 1;',
        [challengeId],
      );
    });

    expect(visibleRows).toHaveLength(1);
  });

  test('throws a redacted VERIFICATION_DELIVERY_FAILED when delivery fails, and still counts the resend, with the earlier code stopped', async () => {
    const binding = createBinding({ actionId: 'verify-resend' });
    const { challengeToken, code } = await issueWithCode(binding);
    let newCode = '';
    let error: unknown;

    try {
      await challenges.resend({ ...binding, challengeToken }, (delivery) => {
        newCode = delivery.code;
        throw new Error(`The mail server refused ${delivery.code} for ${challengeToken}.`);
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
    expect(extractMessage(error)).not.toContain(newCode);
    expect(extractMessage(error)).not.toContain(challengeToken);
    expect(row?.resend_count).toBe(1);
    if (code !== newCode) {
      expect(await challenges.consume({ ...binding, challengeToken, code })).toBe(false);
    }
  });
});

describe('the documented migration', () => {
  test("upgrades 0.3.0's table, which issue and consume use before it and resend after it", async () => {
    const schema = createTableName('verification_v030');
    await postgres.query(`CREATE SCHEMA ${schema};`);
    const legacy = connectTestPostgres({ max: 2, options: `-c search_path=${schema}` });
    try {
      await legacy.query(DDL_0_3_0);
      const legacyChallenges = createVerificationChallenges(legacy, {
        policies: { 'verify-email': { ...POLICY, resendLimit: 1 } },
      });
      const binding = createBinding();
      let code = '';
      const issued = await legacyChallenges.issue(binding, (delivery) => {
        ({ code } = delivery);
      });
      if (issued.outcome !== 'issued') {
        throw new Error('The challenge was not issued.');
      }
      const { challengeToken } = issued;
      expect(await legacyChallenges.consume({ ...binding, challengeToken, code })).toBe(true);
      const pending = await legacyChallenges.issue(
        { ...binding, targetId: 'b@example.com' },
        () => undefined,
      );

      await legacy.query(readDocumentedSql().migration);

      const rows = await legacy.query<{ resend_count: number; resent_at: string | null }>(
        'SELECT resend_count, resent_at FROM verification_challenge ORDER BY id;',
      );
      expect(rows).toStrictEqual([
        { resend_count: 0, resent_at: null },
        { resend_count: 0, resent_at: null },
      ]);
      if (pending.outcome !== 'issued') {
        throw new Error('The second challenge was not issued.');
      }
      expect(
        await legacyChallenges.resend(
          { ...binding, targetId: 'b@example.com', challengeToken: pending.challengeToken },
          () => undefined,
        ),
      ).toMatchObject({ outcome: 'resent' });
    } finally {
      await legacy.close();
      await postgres.query(`DROP SCHEMA ${schema} CASCADE;`);
    }
  });
});

describe('the documented pruning', () => {
  test('deletes the rows older than the age, keeping the younger ones', async () => {
    // the pruning covers the whole table, so the rows the other tests left would count
    await postgres.query('TRUNCATE verification_challenge;');
    const binding = createBinding();
    for (const secondsAgo of [9_000, 8_000, 7_000, 60]) {
      await insertPastChallenge(binding, secondsAgo);
    }

    const { deletedCount } = await deleteExpiredInBatches(postgres, {
      table: 'verification_challenge',
      olderThan: { seconds: 3_600 },
      batchSize: 2,
    });

    expect(deletedCount).toBe(3);
    expect(await readChallenges(binding.actorId)).toHaveLength(1);
  });
});
