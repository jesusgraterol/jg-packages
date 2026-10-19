// a value that survives a trip through JSON, shared with jg-exception
export type { IJsonValue } from 'jg-exception';

/**
 * UUID Version
 * The UUID versions supported by this library.
 */
export type IUuidVersion = 4 | 7;

// a validator for data from outside the program, such as a Zod schema: parse returns the data, or
// throws when it doesn't fit
export type ISchema<T> = {
  parse(value: unknown): T;
};
