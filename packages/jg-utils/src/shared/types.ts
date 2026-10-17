/**
 * JSON Value
 * A value that can be represented in JSON format.
 */
export type IJSONValue =
  string | number | boolean | null | IJSONValue[] | { [key: string]: IJSONValue };

/**
 * UUID Version
 * The UUID versions supported by this library.
 */
export type IUUIDVersion = 4 | 7;
