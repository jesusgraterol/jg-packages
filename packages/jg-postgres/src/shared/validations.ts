/**
 * Checks whether a value is a string of 1 to a number of characters, as varchar counts them.
 * @param value The value.
 * @param maxLength The most characters.
 * @returns Whether it is.
 */
export const isBoundedString = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length > 0 && Array.from(value).length <= maxLength;
