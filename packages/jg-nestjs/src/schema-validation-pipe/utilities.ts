import { MAX_VALIDATION_ISSUES } from './constants.js';
import type { IStandardSchemaIssue, IValidationIssue } from './types.js';

/**
 * Turns a path segment into one JSON can carry: a symbol becomes its description.
 * @param key The segment's key.
 * @returns The key as a string or a number.
 */
const toPathKey = (key: PropertyKey): string | number =>
  typeof key === 'symbol' ? (key.description ?? '') : key;

/**
 * Turns a validator's issues into the ones a response carries: at most MAX_VALIDATION_ISSUES, each
 * with its path as plain keys, however the validator wrote its segments.
 * @param issues The validator's issues.
 * @returns The issues for the response.
 */
export const toValidationIssues = (issues: readonly IStandardSchemaIssue[]): IValidationIssue[] =>
  issues.slice(0, MAX_VALIDATION_ISSUES).map(({ message, path = [] }) => ({
    path: path.map((segment) => toPathKey(typeof segment === 'object' ? segment.key : segment)),
    message,
  }));
