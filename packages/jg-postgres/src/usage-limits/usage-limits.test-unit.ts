import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';

import type { IUsageAdmissionInput } from './types.js';
import { admitUsage } from './usage-limits.js';

const VALID: IUsageAdmissionInput = {
  actorId: '42',
  actionId: 'send-invitation',
  scopeKey: 'invitee',
  limit: 20,
  windowSeconds: 86_400,
  cooldownSeconds: 60,
};

describe('admitUsage', () => {
  test.each<[string, Record<string, unknown>]>([
    ['an empty actor id', { actorId: '' }],
    ['an actor id of 257 characters', { actorId: 'a'.repeat(257) }],
    ['an actor id that is not a string', { actorId: 42 }],
    ['an empty action id', { actionId: '' }],
    ['an action id of 129 characters', { actionId: 'a'.repeat(129) }],
    ['an empty scope key', { scopeKey: '' }],
    ['a scope key of 257 characters', { scopeKey: 'a'.repeat(257) }],
    ['a limit of 0', { limit: 0 }],
    ['a fractional limit', { limit: 1.5 }],
    ['a window of 0 seconds', { windowSeconds: 0 }],
    ['an infinite window', { windowSeconds: Infinity }],
    ['a cooldown of 0 seconds', { cooldownSeconds: 0 }],
    ['a cooldown without a scope', { scopeKey: undefined }],
  ])('throws INVALID_USAGE_ADMISSION for %s, before touching the database', (_, overrides) => {
    const transaction = vi.fn();
    const postgres = { transaction } as unknown as IPostgres;

    expectToThrowCode(
      () => admitUsage(postgres, { ...VALID, ...overrides }),
      ERRORS.INVALID_USAGE_ADMISSION,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  test('counts characters as varchar does, so 256 emoji are a valid actor id', () => {
    const transaction = vi.fn(() => Promise.resolve({ outcome: 'accepted', retryAt: null }));
    const postgres = { transaction } as unknown as IPostgres;

    void admitUsage(postgres, { ...VALID, actorId: '😀'.repeat(256) });

    expect(transaction).toHaveBeenCalledOnce();
  });
});
