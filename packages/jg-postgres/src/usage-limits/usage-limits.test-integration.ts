import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import type { PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { createAdvisoryLockKey } from '../locks/index.js';
import type { IPostgres } from '../postgres/index.js';
import { deleteExpiredInBatches } from '../retention/index.js';
import { connectTestPostgres } from '../test-utils/database.js';

import type { IUsageAdmissionInput } from './types.js';
import { admitUsage } from './usage-limits.js';

/**
 * Reads the SQL block of the README's "Usage limits" section, so the tests run the schema the
 * README documents.
 * @returns The table's DDL.
 */
const readDocumentedSql = (): { ddl: string } => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const section = readme.slice(readme.indexOf('### Usage limits'));
  const [ddl] = [...section.matchAll(/```sql\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
  if (ddl === undefined) {
    throw new Error('The README lost its usage-limit SQL.');
  }
  return { ddl };
};

let postgres: IPostgres;

/**
 * Builds an admission for an actor and an action no other test uses.
 * @param input What to change.
 * @returns The admission's input.
 */
const createInput = (input: Partial<IUsageAdmissionInput> = {}): IUsageAdmissionInput => ({
  actorId: `actor-${randomUUID()}`,
  actionId: `action-${randomUUID()}`,
  limit: 100,
  windowSeconds: 3_600,
  ...input,
});

/**
 * Records a past event, as an earlier admission would have.
 * @param input The actor, action, and scope.
 * @param secondsAgo How long ago it happened.
 */
const insertPastEvent = async (input: IUsageAdmissionInput, secondsAgo: number): Promise<void> => {
  await postgres.query(
    `INSERT INTO usage_event (actor_id, action_id, scope_key, created_at)
    VALUES ($1, $2, $3, clock_timestamp() - make_interval(secs => $4));`,
    [input.actorId, input.actionId, input.scopeKey ?? null, secondsAgo],
  );
};

/**
 * Counts an actor's recorded events, for every action.
 * @param actorId The actor.
 * @returns A promise that resolves to the count.
 */
const countEvents = async (actorId: string): Promise<number> => {
  const [{ usage_count }] = (await postgres.query<{ usage_count: number }>(
    'SELECT count(*)::integer AS usage_count FROM usage_event WHERE actor_id = $1;',
    [actorId],
  )) as [{ usage_count: number }];
  return usage_count;
};

beforeAll(async () => {
  postgres = connectTestPostgres({ max: 8 });
  await postgres.query('DROP TABLE IF EXISTS usage_event;');
  await postgres.query(readDocumentedSql().ddl);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await postgres.query('DROP TABLE usage_event;');
  await postgres.close();
});

describe('admitUsage', () => {
  test('accepts within the limit, without a retryAt when there is no cooldown, then refuses', async () => {
    const input = createInput({ limit: 2 });

    expect(await admitUsage(postgres, input)).toStrictEqual({ outcome: 'accepted', retryAt: null });
    expect(await admitUsage(postgres, input)).toStrictEqual({ outcome: 'accepted', retryAt: null });
    expect(await admitUsage(postgres, input)).toStrictEqual({ outcome: 'limit', retryAt: null });
  });

  test('accepts one of 16 concurrent callers, and gives the other 15 its retryAt', async () => {
    const input = createInput({ scopeKey: 'invitee', cooldownSeconds: 30 });

    const admissions = await Promise.all(
      Array.from({ length: 16 }, () => admitUsage(postgres, input)),
    );
    const accepted = admissions.filter((admission) => admission.outcome === 'accepted');
    const cooldowns = admissions.filter((admission) => admission.outcome === 'cooldown');

    expect(accepted).toHaveLength(1);
    expect(cooldowns).toHaveLength(15);
    expect(accepted[0]?.retryAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    for (const cooldown of cooldowns) {
      expect(cooldown.retryAt).toBe(accepted[0]?.retryAt);
    }
    expect(await countEvents(input.actorId)).toBe(1);
  });

  test('counts each actor and action apart, applies a cooldown to its own action, and records no refusal', async () => {
    const input = createInput({ limit: 1, scopeKey: 'invitee', cooldownSeconds: 30 });

    expect((await admitUsage(postgres, input)).outcome).toBe('accepted');
    expect((await admitUsage(postgres, { ...input, scopeKey: 'other' })).outcome).toBe('limit');
    expect(
      (
        await admitUsage(postgres, {
          ...input,
          actorId: `actor-${randomUUID()}`,
          scopeKey: 'other',
        })
      ).outcome,
    ).toBe('accepted');
    expect(
      (await admitUsage(postgres, { ...input, actionId: `action-${randomUUID()}` })).outcome,
    ).toBe('accepted');
  });

  test('keeps an actor within the limit across distinct scopes, called at once', async () => {
    const input = createInput({ limit: 3, cooldownSeconds: 30 });

    const admissions = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        admitUsage(postgres, { ...input, scopeKey: `scope-${String(index)}` }),
      ),
    );

    expect(admissions.filter((admission) => admission.outcome === 'accepted')).toHaveLength(3);
    expect(admissions.filter((admission) => admission.outcome === 'limit')).toHaveLength(5);
  });

  test('counts only the events within the window', async () => {
    const input = createInput({ limit: 2, windowSeconds: 3_600 });
    await insertPastEvent(input, 7_200);
    await insertPastEvent(input, 7_200);
    await insertPastEvent(input, 60);

    expect((await admitUsage(postgres, input)).outcome).toBe('accepted');
    expect((await admitUsage(postgres, input)).outcome).toBe('limit');
  });

  test('accepts the scope again once the cooldown has passed, for any actor', async () => {
    const input = createInput({ scopeKey: 'invitee', cooldownSeconds: 30 });
    await insertPastEvent(input, 31);

    expect((await admitUsage(postgres, input)).outcome).toBe('accepted');
    expect(
      (await admitUsage(postgres, { ...input, actorId: `actor-${randomUUID()}` })).outcome,
    ).toBe('cooldown');
  });

  test('records an admission delayed by a lock at the time it was recorded, not when it started', async () => {
    const input = createInput({ scopeKey: 'invitee', cooldownSeconds: 1 });
    const holder = await postgres.pool.connect();
    let releasedAt: string | undefined;
    try {
      await holder.query('BEGIN;');
      await holder.query('SELECT pg_advisory_xact_lock($1::bigint);', [
        createAdvisoryLockKey(`jg-postgres:usage-actor:${input.actionId}:${input.actorId}`),
      ]);
      const admission = admitUsage(postgres, input);
      await sleep(1_500);
      const { rows } = await holder.query<{ now: string }>('SELECT clock_timestamp() AS now;');
      releasedAt = rows[0]?.now;
      await holder.query('ROLLBACK;');

      const result = await admission;
      const [event] = await postgres.query<{ created_at: string }>(
        'SELECT created_at FROM usage_event WHERE actor_id = $1;',
        [input.actorId],
      );

      expect(result.outcome).toBe('accepted');
      expect(Date.parse(event?.created_at ?? '')).toBeGreaterThanOrEqual(
        Date.parse(releasedAt ?? ''),
      );
      expect(Date.parse(result.retryAt ?? '')).toBe(Date.parse(event?.created_at ?? '') + 1_000);
    } finally {
      holder.release();
    }
  });

  test('rolls back, and releases its locks, when the database fails', async () => {
    const input = createInput({ scopeKey: 'invitee', cooldownSeconds: 30 });
    const client: PoolClient = await postgres.pool.connect();
    const failure = new Error('could not extend file: no space left on device');
    const realQuery = client.query.bind(client) as (...args: unknown[]) => unknown;
    vi.spyOn(client, 'query').mockImplementation((...args: unknown[]) =>
      typeof args[0] === 'string' && args[0].startsWith('INSERT')
        ? Promise.reject(failure)
        : realQuery(...args),
    );
    vi.spyOn(postgres.pool, 'connect').mockResolvedValueOnce(client as never);

    await expect(admitUsage(postgres, input)).rejects.toBe(failure);
    vi.restoreAllMocks();

    expect(await admitUsage(postgres, input)).toMatchObject({ outcome: 'accepted' });
    expect(await countEvents(input.actorId)).toBe(1);
  });
});

describe('the documented pruning', () => {
  test('deletes the rows older than the age, keeping the younger ones', async () => {
    // the pruning covers the whole table, so the rows the other tests left would count
    await postgres.query('TRUNCATE usage_event;');
    const input = createInput({ scopeKey: 'prune' });
    for (const secondsAgo of [9_000, 8_000, 7_000, 60]) {
      await insertPastEvent(input, secondsAgo);
    }

    const { deletedCount } = await deleteExpiredInBatches(postgres, {
      table: 'usage_event',
      olderThan: { seconds: 3_600 },
      batchSize: 2,
    });

    expect(deletedCount).toBe(3);
    const rows = await postgres.query<{ usage_count: number }>(
      'SELECT count(*)::integer AS usage_count FROM usage_event;',
    );
    expect(rows).toStrictEqual([{ usage_count: 1 }]);
  });
});
