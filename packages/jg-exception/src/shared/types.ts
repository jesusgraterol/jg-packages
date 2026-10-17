/**
 * A value that survives a trip through JSON. An object's values may also be `undefined`, because
 * `JSON.stringify` drops them, so an object with optional fields fits. Interfaces and classes don't
 * fit, because they have no index signature: pass an interface-typed value as `{ ...value }`, or
 * declare its type with `type`.
 */
export type IJSONValue =
  string | number | boolean | null | IJSONValue[] | { [key: string]: IJSONValue | undefined };
