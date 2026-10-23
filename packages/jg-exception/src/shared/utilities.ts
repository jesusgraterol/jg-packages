import { MAX_NESTING_DEPTH } from './constants.js';

/**
 * Serializes a value the way `JSON.stringify` does, but refuses one nested more than
 * `MAX_NESTING_DEPTH` levels deep, which `JSON.stringify` alone would serialize or not depending on
 * how much of the call stack is left. Whatever `JSON.stringify` throws, such as for a value that
 * refers back to itself, is thrown as it is.
 * @param value The value.
 * @returns The JSON text, or `undefined` for a value JSON leaves out, such as a function.
 * @throws
 * - The value is nested too deeply to serialize.
 */
export const stringifyWithinDepth = (value: unknown): string | undefined => {
  // the level of each object whose members are being serialized; the root's holder has none
  const levels = new WeakMap<object, number>();
  // a function rather than an arrow, because JSON.stringify passes each member's holder as `this`
  const limitDepth = function (this: object, _key: string, member: unknown): unknown {
    if (typeof member === 'object' && member !== null) {
      const level = (levels.get(this) ?? 0) + 1;
      if (level > MAX_NESTING_DEPTH) {
        throw new RangeError('The value is nested too deeply to serialize.');
      }
      levels.set(member, level);
    }
    return member;
  };
  return JSON.stringify(value, limitDepth);
};
