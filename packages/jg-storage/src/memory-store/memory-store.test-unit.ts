import { describe, expect, test } from 'vitest';

import { createMemoryStore } from './memory-store.js';

describe('createMemoryStore', () => {
  test('can instantiate a store and manage the root of it', () => {
    const store = createMemoryStore('unit_test');
    expect(store.id).toBe('unit_test');
    expect(store.mechanism).toBe('tempMemory');
    expect(store.isCompatible()).toBe(true);
    expect(store.get()).toBeUndefined();
    store.set(undefined, { foo: 'bar' });
    expect(store.get()).toStrictEqual({ foo: 'bar' });
    store.set(undefined, { foo: 'bar2' });
    expect(store.get()).toStrictEqual({ foo: 'bar2' });
    store.del();
    expect(store.get()).toBeUndefined();
  });

  test('can instantiate a store and manage its data based on record ids', () => {
    const store = createMemoryStore('unit_test_2');
    const id = '16ceb975-4989-4c86-8b63-99294e86a13d';
    expect(store.get(id)).toBeUndefined();
    store.set(id, { foo: 'bar' });
    expect(store.get(id)).toStrictEqual({ foo: 'bar' });
    store.set(id, { foo: 'bar2' });
    expect(store.get(id)).toStrictEqual({ foo: 'bar2' });
    store.del(id);
    expect(store.get(id)).toBeUndefined();
  });

  test('keeps primitive values and records for each store instance only', () => {
    const first = createMemoryStore<number | string>('shared-id');
    const second = createMemoryStore<number | string>('shared-id');
    first.set(undefined, 1);
    first.set(2, 'two');
    expect(first.get()).toBe(1);
    expect(first.get(2)).toBe('two');
    expect(second.get()).toBeUndefined();
    expect(second.get(2)).toBeUndefined();
  });

  test('accepts store ids that match Object.prototype properties', () => {
    const store = createMemoryStore<string>('__proto__');
    store.set(undefined, 'root');
    expect(store.get()).toBe('root');
    expect(createMemoryStore<string>('constructor').get()).toBeUndefined();
  });

  test('runs the schema on every stored value get reads, and lets its errors propagate', () => {
    const store = createMemoryStore('parsed', {
      schema: {
        parse: (value: unknown) => {
          if (typeof value !== 'number') {
            throw new Error('not a number');
          }
          return value * 2;
        },
      },
    });
    expect(store.get()).toBeUndefined();
    store.set(undefined, 21);
    expect(store.get()).toBe(42);
    expect(store.get()).toBe(42);
    store.set('bad', 'oops' as unknown as number);
    expect(() => store.get('bad')).toThrow('not a number');
  });
});
