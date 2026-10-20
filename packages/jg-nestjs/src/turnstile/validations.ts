import type { ISiteverifyResponse } from './types.js';

/**
 * Reads siteverify's answer: `success` must be a boolean, `error-codes` an array of strings, and
 * `hostname` and `action` strings when present. Other fields, which Cloudflare adds over time, are
 * ignored.
 * @param value The parsed JSON.
 * @returns The fields the guard reads, or undefined when the answer has another shape.
 */
export const readSiteverifyResponse = (value: unknown): ISiteverifyResponse | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { success, 'error-codes': errorCodes, hostname, action } = value as Record<string, unknown>;
  const isOptionalString = (field: unknown): field is string | undefined =>
    field === undefined || typeof field === 'string';
  if (
    typeof success !== 'boolean' ||
    !Array.isArray(errorCodes) ||
    !errorCodes.every((code: unknown): code is string => typeof code === 'string') ||
    !isOptionalString(hostname) ||
    !isOptionalString(action)
  ) {
    return undefined;
  }
  return { success, errorCodes, hostname, action };
};
