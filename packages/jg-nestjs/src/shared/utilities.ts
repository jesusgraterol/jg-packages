/**
 * Checks whether a value is an HTTP error status: an integer from 400 to 599.
 * @param value The value.
 * @returns Whether it is.
 */
export const isErrorStatus = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 400 && (value as number) <= 599;
