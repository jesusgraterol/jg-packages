import { redactSensitiveValues } from '../error-handler/utilities.js';
import type { IJsonValue } from '../shared/types.js';
import { EXCEPTION_BRAND } from './constants.js';

/*
 * Redaction keeps given values out of an Exception: its message, its data, and every cause, which
 * becomes a snapshot that runs none of the cause's own code. The values are passed along only
 * while the exception is built; nothing here keeps them.
 */

// the parts of an Exception that redaction rewrites
export type IRedactableParts = {
  message: string;
  data: IJsonValue | undefined;
  cause: unknown;
};

// a class whose prototype a recognised Exception's snapshot takes
type IExceptionClass = abstract new (...args: never[]) => Error;

// what the snapshots of a cause chain are built with
type IRedactionContext = {
  values: string[];
  exceptionClass: IExceptionClass;
  // each object cause met so far, with its snapshot, so a cycle leads back to the same snapshot
  snapshots: Map<object, unknown>;
};

// a value that isn't an object, which redaction copies as it is or as its redacted text
type IPrimitive = string | number | bigint | boolean | symbol | null | undefined;

// the properties a snapshot builds itself, instead of copying them as plain fields
const BUILT_PROPERTIES: ReadonlySet<string> = new Set(['name', 'message', 'stack', 'cause']);

// the most prototypes a lookup walks, so a proxy that keeps returning new prototypes can't hang it
const MAX_PROTOTYPE_DEPTH = 32;

// an array index, the only array keys JSON keeps
const ARRAY_INDEX = /^(?:0|[1-9]\d*)$/;

/**
 * Finds a property's descriptor on an object or one of its prototypes, without reading it.
 * @param target The object.
 * @param key The property.
 * @returns The descriptor, or an empty one when no object in the chain has the property.
 */
const findDescriptor = (target: object, key: PropertyKey): PropertyDescriptor => {
  let current: object | null = target;
  for (let depth = 0; current !== null && depth < MAX_PROTOTYPE_DEPTH; depth += 1) {
    const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
    if (descriptor !== undefined) {
      return descriptor;
    }
    current = Reflect.getPrototypeOf(current);
  }
  return {};
};

// the getter an engine that keeps an error's stack behind an accessor installs for it, such as
// V8's; the only getter redaction ever calls, because it runs the engine's code, not the cause's
const ENGINE_STACK_GETTER: unknown = Reflect.get(findDescriptor(new Error(), 'stack'), 'get');

/**
 * Reads a property the way a snapshot may: a data property's value, or a stack through the
 * engine's own getter. Any other getter could run the object's code, so it reads as `undefined`.
 * @param target The object the descriptor belongs to.
 * @param descriptor The property's descriptor, empty when the object has no such property.
 * @returns The value, or `undefined`.
 */
const readDescriptor = (target: object, descriptor: PropertyDescriptor): unknown => {
  if ('value' in descriptor) {
    return descriptor.value;
  }
  const getter: unknown = Reflect.get(descriptor, 'get');
  return typeof getter === 'function' && getter === ENGINE_STACK_GETTER
    ? Reflect.apply(getter, target, [])
    : undefined;
};

/**
 * Reads a property of a cause, left as `undefined` when it can't be read, such as behind a proxy
 * that throws.
 * @param target The cause.
 * @param key The property.
 * @param isInherited Whether the cause's prototypes are searched too.
 * @returns The value, or `undefined`.
 */
const readProperty = (target: object, key: PropertyKey, isInherited: boolean): unknown => {
  try {
    return readDescriptor(
      target,
      isInherited
        ? findDescriptor(target, key)
        : (Reflect.getOwnPropertyDescriptor(target, key) ?? {}),
    );
  } catch {
    return undefined;
  }
};

/**
 * Lists an object's own enumerable data properties with string keys, leaving out the ones that
 * can't be read and every getter.
 * @param target The object.
 * @returns Each property's key and value.
 */
const readDataEntries = (target: object): [string, unknown][] => {
  let keys: (string | symbol)[];
  try {
    keys = Reflect.ownKeys(target);
  } catch {
    return [];
  }
  return keys.flatMap((key): [string, unknown][] => {
    if (typeof key !== 'string') {
      return [];
    }
    try {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      return descriptor?.enumerable === true && 'value' in descriptor
        ? [[key, descriptor.value]]
        : [];
    } catch {
      return [];
    }
  });
};

/**
 * Defines a property the way an assignment would, without running a setter or reaching a
 * prototype through a key such as `__proto__`.
 * @param target The object.
 * @param key The property.
 * @param value The value.
 * @param enumerable Whether the property is listed, like a field, or hidden, like an error's stack.
 */
const defineValue = (target: object, key: PropertyKey, value: unknown, enumerable: boolean) => {
  Object.defineProperty(target, key, { value, enumerable, writable: true, configurable: true });
};

/**
 * Checks whether a value isn't an object, so it can't hold code or other values.
 * @param value The value.
 * @returns Whether it's a primitive.
 */
const isPrimitive = (value: unknown): value is IPrimitive =>
  value === null || (typeof value !== 'object' && typeof value !== 'function');

/**
 * Redacts a value that isn't an object: a string's matches, and any other primitive whose text
 * holds a value, such as a numeric one-time code, which becomes that redacted text.
 * @param value The value.
 * @param values The values to redact.
 * @returns The redacted value.
 */
const redactPrimitive = (value: IPrimitive, values: string[]): IPrimitive => {
  if (typeof value === 'string') {
    return redactSensitiveValues(value, values);
  }
  if (value === null || value === undefined) {
    return value;
  }
  const text = String(value);
  const redacted = redactSensitiveValues(text, values);
  return redacted === text ? value : redacted;
};

/**
 * Copies a JSON value with every string redacted, reading only data properties. Keys stay, and a
 * value JSON can't hold, or one that refers back to an object around it, is left out.
 * @param value The value.
 * @param values The values to redact.
 * @param ancestors The objects around the value, which a cycle would lead back to.
 * @returns The redacted copy, or `undefined` when the value is left out.
 */
const redactJson = (
  value: unknown,
  values: string[],
  ancestors: Set<object>,
): IJsonValue | undefined => {
  if (typeof value !== 'object' || value === null) {
    // JSON holds no function, symbol, or BigInt
    return typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint'
      ? undefined
      : (redactPrimitive(value as IPrimitive, values) as IJsonValue | undefined);
  }
  if (ancestors.has(value)) {
    return undefined;
  }
  ancestors.add(value);
  try {
    const entries = readDataEntries(value);
    if (Array.isArray(value)) {
      const copy: IJsonValue[] = [];
      for (const [key, item] of entries) {
        if (ARRAY_INDEX.test(key)) {
          copy[Number(key)] = redactJson(item, values, ancestors) ?? null;
        }
      }
      return copy;
    }
    const copy: { [key: string]: IJsonValue | undefined } = {};
    for (const [key, item] of entries) {
      const redacted = redactJson(item, values, ancestors);
      if (redacted !== undefined) {
        defineValue(copy, key, redacted, true);
      }
    }
    return copy;
  } finally {
    ancestors.delete(value);
  }
};

/**
 * Copies JSON data with every string redacted, or gives `null` when it can't be copied, such as
 * data nested too deeply to walk.
 * @param data The data.
 * @param values The values to redact.
 * @returns The redacted copy.
 */
const redactData = (data: unknown, values: string[]): IJsonValue | undefined => {
  try {
    return redactJson(data, values, new Set());
  } catch {
    return null;
  }
};

/**
 * Builds a cause's snapshot: an `Error` with the cause's name, message, stack, plain fields, and
 * cause, redacted, that runs none of the cause's code. Fields holding objects are left out. A
 * recognised Exception's snapshot is an Exception, with its brand and data, so `isException` and
 * `toJSON()` still work on it.
 * @param cause The cause.
 * @param context The values and the snapshots built so far.
 * @returns The snapshot.
 */
const createSnapshot = (cause: object, context: IRedactionContext): Error => {
  const { values, exceptionClass, snapshots } = context;
  const isRecognisedException = readProperty(cause, EXCEPTION_BRAND, false) === true;
  const message = readProperty(cause, 'message', false);
  const snapshot = Reflect.construct(
    Error,
    [typeof message === 'string' ? redactSensitiveValues(message, values) : ''],
    isRecognisedException ? exceptionClass : Error,
  ) as Error;
  snapshots.set(cause, snapshot);

  const name = readProperty(cause, 'name', true);
  defineValue(
    snapshot,
    'name',
    typeof name === 'string' ? redactSensitiveValues(name, values) : 'Error',
    false,
  );
  const stack = readProperty(cause, 'stack', true);
  if (typeof stack === 'string') {
    defineValue(snapshot, 'stack', redactSensitiveValues(stack, values), false);
  } else {
    // the stack captured here would point at this file, not at where the cause came from
    Reflect.deleteProperty(snapshot, 'stack');
  }

  for (const [key, value] of readDataEntries(cause)) {
    const isBuilt = BUILT_PROPERTIES.has(key) || (isRecognisedException && key === 'data');
    if (!isBuilt && isPrimitive(value)) {
      defineValue(snapshot, key, redactPrimitive(value, values), true);
    }
  }
  if (isRecognisedException) {
    Object.defineProperty(snapshot, EXCEPTION_BRAND, { value: true });
    const data = readProperty(cause, 'data', false);
    defineValue(snapshot, 'data', data === undefined ? undefined : redactData(data, values), true);
  }
  let hasCause: boolean;
  try {
    hasCause = Reflect.getOwnPropertyDescriptor(cause, 'cause') !== undefined;
  } catch {
    hasCause = false;
  }
  if (hasCause) {
    defineValue(
      snapshot,
      'cause',
      redactCause(readProperty(cause, 'cause', false), context),
      false,
    );
  }
  return snapshot;
};

/**
 * Redacts a cause: a primitive like any value, and an object as its snapshot.
 * @param cause The cause.
 * @param context The values and the snapshots built so far.
 * @returns The redacted cause, or `undefined` when it can't be copied, such as a chain too deep to
 * walk.
 */
const redactCause = (cause: unknown, context: IRedactionContext): unknown => {
  if (isPrimitive(cause)) {
    return redactPrimitive(cause, context.values);
  }
  if (context.snapshots.has(cause)) {
    return context.snapshots.get(cause);
  }
  try {
    return createSnapshot(cause, context);
  } catch {
    return undefined;
  }
};

/**
 * Lists the values to redact: each non-empty string once, as written and, when different,
 * URL-encoded. A list that can't be read, from a caller that skips type checking, adds nothing.
 * @param redact The `redact` option.
 * @returns The values.
 */
const toRedactionValues = (redact: unknown): string[] => {
  const values = new Set<string>();
  try {
    for (const value of Array.isArray(redact) ? (redact as unknown[]) : []) {
      if (typeof value === 'string' && value.length > 0) {
        values.add(value);
        try {
          values.add(encodeURIComponent(value));
        } catch {
          // a lone surrogate has no URL-encoded form
        }
      }
    }
  } catch {
    // the values read before the list failed are still redacted
  }
  return [...values];
};

/**
 * Redacts an exception's message, data, and cause chain before it's built. Without values to
 * redact, the parts are returned as given.
 * @param parts The message, data, and cause.
 * @param redact The `redact` option.
 * @param exceptionClass The class a recognised Exception's snapshot belongs to.
 * @returns The redacted parts.
 */
export const redactExceptionParts = (
  parts: IRedactableParts,
  redact: unknown,
  exceptionClass: IExceptionClass,
): IRedactableParts => {
  const values = toRedactionValues(redact);
  if (values.length === 0) {
    return parts;
  }
  let message: string;
  try {
    // the text Error makes of the message, which differs only for callers that skip type checking
    message = redactSensitiveValues(new Error(parts.message).message, values);
  } catch {
    // a message that can't become text, from a caller that skips type checking
    message = '';
  }
  return {
    message,
    data: parts.data === undefined ? undefined : redactData(parts.data, values),
    cause: redactCause(parts.cause, { values, exceptionClass, snapshots: new Map() }),
  };
};
