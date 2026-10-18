import { describe, expect, test, vi } from 'vitest';

import {
  deleteCooldownDeadline,
  getAdvisoryDeadline,
  getRemainingSeconds,
  readCooldownDeadline,
  saveCooldownDeadline,
  toAttemptedAtMs,
} from './utilities.js';

// a session store the tests control: its records, and whether reading or writing throws
type IFakeStore = {
  records: Map<string, unknown>;
  failGet: boolean;
  failWrite: boolean;
};

// every fake store the mocked createSessionStore created, by store id
const fakeStores = new Map<string, IFakeStore>();

vi.mock('jg-storage', () => ({
  createSessionStore: (storeId: string) => {
    const fake: IFakeStore = { records: new Map(), failGet: false, failWrite: false };
    fakeStores.set(storeId, fake);
    return {
      id: storeId,
      mechanism: 'sessionStorage',
      isCompatible: () => true,
      get: (key: string) => {
        if (fake.failGet) {
          throw new Error('FAILED_TO_PARSE_JSON');
        }
        return fake.records.get(key);
      },
      set: (key: string, value: unknown) => {
        if (fake.failWrite) {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        }
        fake.records.set(key, value);
      },
      del: (key: string) => {
        if (fake.failWrite) {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        }
        fake.records.delete(key);
      },
    };
  },
}));

const NOW = 1_800_000_000_000;

/**
 * Gives a test's own store id, and creates its fake store.
 * @param name The test's name for it.
 * @returns The store id and its fake store.
 */
const useStore = (name: string): { storeId: string; fake: IFakeStore } => {
  readCooldownDeadline(name, 'probe', NOW);
  const fake = fakeStores.get(name);
  if (fake === undefined) {
    throw new Error('The store was not created.');
  }
  return { storeId: name, fake };
};

describe('the stored deadlines', () => {
  test('reads a deadline ahead, and gives nothing for a missing one', () => {
    const { storeId, fake } = useStore('read-ahead');
    fake.records.set('account-a:verify-email', NOW + 30_000);

    expect(readCooldownDeadline(storeId, 'account-a:verify-email', NOW)).toBe(NOW + 30_000);
    expect(readCooldownDeadline(storeId, 'account-b:verify-email', NOW)).toBeUndefined();
  });

  test.each([
    ['a deadline that has passed', NOW],
    ['a fraction', NOW + 0.5],
    ['a negative number', -1],
    ['a string', String(NOW + 30_000)],
    ['an object', { deadline: NOW + 30_000 }],
  ])('treats %s as missing, and deletes it', (description, value) => {
    const { storeId, fake } = useStore(`invalid-${description.replaceAll(' ', '-')}`);
    fake.records.set('key', value);

    expect(readCooldownDeadline(storeId, 'key', NOW)).toBeUndefined();
    expect(fake.records.has('key')).toBe(false);
  });

  test('treats a record that cannot be read as missing, and deletes it', () => {
    const { storeId, fake } = useStore('unreadable');
    fake.records.set('key', NOW + 30_000);
    fake.failGet = true;

    expect(readCooldownDeadline(storeId, 'key', NOW)).toBeUndefined();
    expect(fake.records.has('key')).toBe(false);
  });

  test('saves a deadline to the store, and deletes it', () => {
    const { storeId, fake } = useStore('save');

    saveCooldownDeadline(storeId, 'key', NOW + 60_000);
    expect(fake.records.get('key')).toBe(NOW + 60_000);
    expect(readCooldownDeadline(storeId, 'key', NOW)).toBe(NOW + 60_000);

    deleteCooldownDeadline(storeId, 'key');
    expect(fake.records.has('key')).toBe(false);
  });

  test('keeps deadlines in memory for the rest of the page once a write throws', () => {
    const { storeId, fake } = useStore('blocked');
    saveCooldownDeadline(storeId, 'earlier', NOW + 10_000);
    fake.failWrite = true;

    saveCooldownDeadline(storeId, 'key', NOW + 60_000);
    fake.failWrite = false;
    fake.records.clear();

    expect(readCooldownDeadline(storeId, 'key', NOW)).toBe(NOW + 60_000);
    expect(readCooldownDeadline(storeId, 'earlier', NOW)).toBe(NOW + 10_000);
    saveCooldownDeadline(storeId, 'later', NOW + 5_000);
    expect(fake.records.size).toBe(0);
    deleteCooldownDeadline(storeId, 'key');
    expect(readCooldownDeadline(storeId, 'key', NOW)).toBeUndefined();
  });
});

describe('toAttemptedAtMs', () => {
  test.each([
    [new Date(NOW), NOW],
    [NOW, NOW],
    [new Date(NOW).toISOString(), NOW],
    [0, 0],
    [null, undefined],
    [undefined, undefined],
    ['not a date', undefined],
    [-1, undefined],
    [Number.NaN, undefined],
    [Number.POSITIVE_INFINITY, undefined],
    [new Date(Number.NaN), undefined],
  ])('toAttemptedAtMs(%o) -> %o', (value, expected) => {
    expect(toAttemptedAtMs(value)).toBe(expected);
  });
});

describe('getAdvisoryDeadline', () => {
  test('adds the duration to the last send', () => {
    expect(getAdvisoryDeadline(NOW - 30_000, 60_000, NOW)).toBe(NOW + 30_000);
  });

  test('counts a send in the future as the moment it was seen, so the wait is one duration at most', () => {
    expect(getAdvisoryDeadline(NOW + 300_000, 60_000, NOW)).toBe(NOW + 60_000);
  });

  test('gives no deadline without a send', () => {
    expect(getAdvisoryDeadline(undefined, 60_000, NOW)).toBeUndefined();
  });
});

describe('getRemainingSeconds', () => {
  test.each([
    [undefined, 0],
    [NOW + 60_000, 60],
    [NOW + 59_001, 60],
    [NOW + 1, 1],
    [NOW, 0],
    [NOW - 5_000, 0],
  ])('getRemainingSeconds(%o) -> %d', (deadlineMs, expected) => {
    expect(getRemainingSeconds(deadlineMs, NOW)).toBe(expected);
  });
});
