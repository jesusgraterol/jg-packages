import { createSessionStore, type ISyncStore } from 'jg-storage';

/*
 * Each cooldown's deadline is a record of a jg-storage session store, keyed by the cooldown, so it
 * survives a reload of the tab. A write that throws, such as when storage is full or blocked, moves
 * that store to memory for the rest of the page, where every deadline also lives.
 */

// each store id's session store, created the first time a cooldown reads or writes it
const stores = new Map<string, ISyncStore<number>>();

// each store id's deadlines, by cooldown key, mirroring the last value written
const memoryDeadlines = new Map<string, Map<string, number>>();

// the store ids whose writes failed, which keep their deadlines in memory only
const memoryOnlyStoreIds = new Set<string>();

/**
 * Gives a store id's session store, creating it the first time.
 * @param storeId The store id.
 * @returns The store.
 * @throws
 * - INVALID_STORE_ID: The store id must hold only letters, digits, underscores, and hyphens.
 */
const getStore = (storeId: string): ISyncStore<number> => {
  let store = stores.get(storeId);
  if (store === undefined) {
    store = createSessionStore<number>(storeId, { fallback: 'memory' });
    stores.set(storeId, store);
  }
  return store;
};

/**
 * Gives a store id's deadlines in memory.
 * @param storeId The store id.
 * @returns The deadlines, by cooldown key.
 */
const getMemory = (storeId: string): Map<string, number> => {
  let deadlines = memoryDeadlines.get(storeId);
  if (deadlines === undefined) {
    deadlines = new Map();
    memoryDeadlines.set(storeId, deadlines);
  }
  return deadlines;
};

/**
 * Runs a write to a store, moving the store id to memory when it throws.
 * @param storeId The store id.
 * @param write The write.
 */
const writeToStore = (storeId: string, write: (store: ISyncStore<number>) => void): void => {
  if (memoryOnlyStoreIds.has(storeId)) {
    return;
  }
  try {
    write(getStore(storeId));
  } catch {
    memoryOnlyStoreIds.add(storeId);
  }
};

/**
 * Forgets a cooldown's deadline.
 * @param storeId The store id.
 * @param cooldownKey The cooldown.
 */
export const deleteCooldownDeadline = (storeId: string, cooldownKey: string): void => {
  getMemory(storeId).delete(cooldownKey);
  writeToStore(storeId, (store) => {
    store.del(cooldownKey);
  });
};

/**
 * Keeps a cooldown's deadline, in the session store and in memory.
 * @param storeId The store id.
 * @param cooldownKey The cooldown.
 * @param deadlineMs The deadline, in milliseconds since the epoch.
 */
export const saveCooldownDeadline = (
  storeId: string,
  cooldownKey: string,
  deadlineMs: number,
): void => {
  getMemory(storeId).set(cooldownKey, deadlineMs);
  writeToStore(storeId, (store) => {
    store.set(cooldownKey, deadlineMs);
  });
};

/**
 * Reads a cooldown's deadline while it lies ahead. A value that isn't a positive safe integer, one
 * that can't be read, or one that has passed counts as missing, and is deleted.
 * @param storeId The store id.
 * @param cooldownKey The cooldown.
 * @param nowMs The current time, in milliseconds since the epoch.
 * @returns The deadline, or `undefined`.
 */
export const readCooldownDeadline = (
  storeId: string,
  cooldownKey: string,
  nowMs: number,
): number | undefined => {
  let deadline: unknown;
  let isUnreadable = false;
  if (memoryOnlyStoreIds.has(storeId)) {
    deadline = getMemory(storeId).get(cooldownKey);
  } else {
    try {
      deadline = getStore(storeId).get(cooldownKey);
    } catch {
      isUnreadable = true;
    }
  }
  if (typeof deadline === 'number' && Number.isSafeInteger(deadline) && deadline > nowMs) {
    return deadline;
  }
  if (deadline !== undefined || isUnreadable) {
    deleteCooldownDeadline(storeId, cooldownKey);
  }
  return undefined;
};

/**
 * Reads when the server says the last send happened, in milliseconds since the epoch.
 * @param lastAttemptedAt A Date, a millisecond epoch, or a date string.
 * @returns The time, or `undefined` when there's none or it isn't a valid time.
 */
export const toAttemptedAtMs = (
  lastAttemptedAt: string | number | Date | null | undefined,
): number | undefined => {
  if (lastAttemptedAt === null || lastAttemptedAt === undefined) {
    return undefined;
  }
  const attemptedAtMs =
    lastAttemptedAt instanceof Date
      ? lastAttemptedAt.getTime()
      : typeof lastAttemptedAt === 'number'
        ? lastAttemptedAt
        : Date.parse(lastAttemptedAt);
  return Number.isFinite(attemptedAtMs) && attemptedAtMs >= 0 ? attemptedAtMs : undefined;
};

/**
 * Gives the deadline the server's last send implies. A time in the future, as a skewed server
 * clock gives, counts as the moment it was seen, so the wait is never longer than one duration.
 * @param attemptedAtMs When the server says the last send happened, or `undefined`.
 * @param durationMs The cooldown's duration, in milliseconds.
 * @param observedAtMs When that time was seen.
 * @returns The deadline, or `undefined` without a send.
 */
export const getAdvisoryDeadline = (
  attemptedAtMs: number | undefined,
  durationMs: number,
  observedAtMs: number,
): number | undefined =>
  attemptedAtMs === undefined ? undefined : Math.min(attemptedAtMs, observedAtMs) + durationMs;

/**
 * Gives the whole seconds left until a deadline, rounded up.
 * @param deadlineMs The deadline, or `undefined` for none.
 * @param nowMs The current time.
 * @returns The seconds, 0 once the deadline has passed.
 */
export const getRemainingSeconds = (deadlineMs: number | undefined, nowMs: number): number =>
  deadlineMs === undefined ? 0 : Math.ceil(Math.max(0, deadlineMs - nowMs) / 1000);
