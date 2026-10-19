import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';
import type { ISearchParamKinds } from './types.js';

/**
 * Builds the exception for a value a search parameter can't hold.
 * @param key The parameter.
 * @returns The INVALID_SEARCH_PARAM_VALUE exception.
 */
const invalidValue = (key: string): Exception =>
  new Exception(
    "A search parameter's value must be a string, a finite number, a boolean, null, or undefined, or a list of them for a repeated parameter.",
    { code: ERRORS.INVALID_SEARCH_PARAM_VALUE, data: { key } },
  );

/**
 * Turns one value into its URL string, or null for a value that's left out.
 * @param value The value.
 * @param key The parameter, for the error.
 * @returns The string, or null for null and undefined.
 * @throws
 * - INVALID_SEARCH_PARAM_VALUE: A search parameter's value must be a string, a finite number, a boolean, null, or undefined, or a list of them for a repeated parameter.
 */
const toParamString = (value: unknown, key: string): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
    return String(value);
  }
  throw invalidValue(key);
};

/**
 * Turns a key's value into the strings its parameter holds: one at most for 'one', and one per
 * item for 'many'.
 * @param value The value.
 * @param key The parameter.
 * @param kind How the parameter holds its value.
 * @returns The strings, empty when the value is left out.
 * @throws
 * - INVALID_SEARCH_PARAM_VALUE: A search parameter's value must be a string, a finite number, a boolean, null, or undefined, or a list of them for a repeated parameter.
 */
const toParamStrings = (value: unknown, key: string, kind: 'one' | 'many'): string[] => {
  if (kind === 'many') {
    if (!Array.isArray(value)) {
      throw invalidValue(key);
    }
    return value
      .map((item: unknown) => toParamString(item, key))
      .filter((item): item is string => item !== null);
  }
  const text = toParamString(value, key);
  return text === null ? [] : [text];
};

/**
 * Reads the owned keys from the URL's parameters as the schema's input: the first string of a
 * 'one' key, every string of a 'many' key, and the default for a key the URL doesn't hold.
 * @param searchParams The URL's parameters.
 * @param params Each owned key's kind.
 * @param defaultValue The state without parameters.
 * @returns The input, by key.
 */
export const readSearchParamInput = <T extends object>(
  searchParams: URLSearchParams,
  params: ISearchParamKinds<T>,
  defaultValue: T,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries<'one' | 'many'>(params).map(([key, kind]) => {
      const values = searchParams.getAll(key);
      if (values.length === 0) {
        return [key, (defaultValue as Record<string, unknown>)[key]];
      }
      return [key, kind === 'one' ? values[0] : values];
    }),
  );

/**
 * Builds the search string a state belongs at: the parameters the state doesn't own, unless
 * they're removed, in their order, then each owned key that isn't at its default, in the order
 * params lists them, a repeated key once per item.
 * @param value The state.
 * @param current The URL's parameters now.
 * @param params Each owned key's kind.
 * @param defaultValue The state without parameters.
 * @param shouldKeepUnknown Whether the parameters the state doesn't own stay.
 * @returns The search, without the leading `?`.
 * @throws
 * - INVALID_SEARCH_PARAM_VALUE: A search parameter's value must be a string, a finite number, a boolean, null, or undefined, or a list of them for a repeated parameter.
 */
export const buildSearch = <T extends object>(
  value: T,
  current: URLSearchParams,
  params: ISearchParamKinds<T>,
  defaultValue: T,
  shouldKeepUnknown: boolean,
): string => {
  const kinds = Object.entries<'one' | 'many'>(params);
  const next = new URLSearchParams();
  if (shouldKeepUnknown) {
    for (const [key, text] of current) {
      if (!Object.hasOwn(params, key)) {
        next.append(key, text);
      }
    }
  }
  for (const [key, kind] of kinds) {
    const strings = toParamStrings((value as Record<string, unknown>)[key], key, kind);
    const defaults = toParamStrings((defaultValue as Record<string, unknown>)[key], key, kind);
    const isDefault =
      strings.length === defaults.length &&
      strings.every((text, index) => text === defaults[index]);
    if (!isDefault) {
      for (const text of strings) {
        next.append(key, text);
      }
    }
  }
  return next.toString();
};

/**
 * Decides whether to replace a search that isn't canonical: never twice from the same search,
 * as StrictMode's repeated effects would, and never from the search a repair just went to, as a
 * schema that doesn't round-trip would ask, so a repair never loops.
 * @param current The search now.
 * @param canonical The search the state belongs at.
 * @param last The last repair, from and to, or null.
 * @returns Whether to replace the search.
 */
export const shouldRepairSearch = (
  current: string,
  canonical: string,
  last: { from: string; to: string } | null,
): boolean => current !== canonical && current !== last?.from && current !== last?.to;
