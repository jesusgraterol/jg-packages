import { REDACTED_VALUE } from '../shared/constants.js';

// a copy of a plain object or an array, filled after it's created
type ICopy = Record<string, unknown> | unknown[];

/**
 * Checks whether a value is copied rather than kept as it is: a plain object, including one
 * without a prototype, or an array.
 * @param value The value.
 * @returns Whether it's copied.
 */
const isCopied = (value: unknown): value is ICopy => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return Array.isArray(value) || prototype === Object.prototype || prototype === null;
};

/**
 * Copies a value, such as a request body headed for an error report, with the values of the
 * named fields replaced by `[redacted]`, however deep they are. Keys match case-insensitively, so
 * `password` also redacts `Password`. Plain objects and arrays are copied, and anything else, such
 * as a Date, is kept as it is; the original is never changed.
 * @param value The value.
 * @param keys The names of the fields to redact, such as `['password', 'token']`.
 * @returns The copy, typed `unknown` because any field may now hold `[redacted]` instead of its
 * own type.
 * @example
 * import { redactFields } from 'jg-exception';
 *
 * const body = { email: 'ada@example.com', profile: { Password: 'hunter2' } };
 *
 * redactFields(body, ['password']); // => { email: 'ada@example.com', profile: { Password: '[redacted]' } }
 */
export const redactFields = (value: unknown, keys: readonly string[]): unknown => {
  const redactedKeys = new Set(keys.map((key) => key.toLowerCase()));

  // each object's copy, so a value that refers back to itself is copied once
  const copies = new WeakMap<object, ICopy>();

  // the objects whose copies are still empty, walked with a list rather than recursion, so no
  // nesting depth, such as a crafted request body's, can overflow the stack
  const pending: [ICopy, ICopy][] = [];

  const copy = (item: unknown): unknown => {
    if (!isCopied(item)) {
      return item;
    }
    const existing = copies.get(item);
    if (existing !== undefined) {
      return existing;
    }
    const itemCopy: ICopy = Array.isArray(item) ? [] : {};
    copies.set(item, itemCopy);
    pending.push([item, itemCopy]);
    return itemCopy;
  };

  const root = copy(value);
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const [source, target] = next;
    if (Array.isArray(source) && Array.isArray(target)) {
      // pushed one by one, because spreading a long array would pass too many arguments
      for (const item of source) {
        target.push(copy(item));
      }
      continue;
    }
    for (const [key, field] of Object.entries(source)) {
      // defined rather than assigned, so a "__proto__" key from JSON.parse stays a plain field
      Object.defineProperty(target, key, {
        value: redactedKeys.has(key.toLowerCase()) ? REDACTED_VALUE : copy(field),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  }
  return root;
};
