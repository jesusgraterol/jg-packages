import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import type { ISetSearchParamState, IUseSearchParamStateOptions } from './types.js';
import { buildSearch, readSearchParamInput, shouldRepairSearch } from './utilities.js';

// the state changes made in one tick, navigated to once at its end
type IPendingChange<T> = { value: T; replace: boolean };

/**
 * Keeps typed state, such as a list's filters and page, in the URL's search parameters. It reads
 * the owned keys through the schema, with the defaults filling missing keys, and falls back to
 * `defaultValue` when the schema rejects them. The URL holds the state's canonical form, without
 * keys at their defaults; a URL that isn't canonical, such as an old bookmark, is replaced once,
 * keeping the router state and the hash, so the way back to the previous page isn't lost. The
 * value keeps its identity while the URL's owned keys don't change.
 *
 * The setter keeps its identity, takes a value or an updater, and pushes a history entry unless
 * given `replace`. Changes made in the same tick compose, each updater seeing the one before it,
 * and navigate once, keeping the router state and the hash; a change to the current search
 * navigates nowhere. Parameters the state doesn't own stay, unless `unknownParams` is 'remove'.
 * @param options The owned keys, the schema, the defaults, and what happens to other keys.
 * @returns The value, and its setter.
 * @example
 * import { useSearchParamState } from 'jg-react-router';
 * import { z } from 'zod';
 *
 * const FiltersSchema = z.object({
 *   query: z.string(),
 *   page: z.coerce.number().int().min(1),
 *   tags: z.array(z.string()),
 * });
 *
 * export const usePaymentFilters = () =>
 *   useSearchParamState({
 *     params: { query: 'one', page: 'one', tags: 'many' },
 *     schema: FiltersSchema,
 *     defaultValue: { query: '', page: 1, tags: [] },
 *   });
 * @throws
 * - INVALID_SEARCH_PARAM_VALUE: A search parameter's value must be a string, a finite number, a boolean, null, or undefined, or a list of them for a repeated parameter.
 */
export const useSearchParamState = <T extends object>(
  options: IUseSearchParamStateOptions<T>,
): [T, ISetSearchParamState<T>] => {
  const { params, schema, defaultValue, unknownParams } = options;
  const location = useLocation();
  const navigate = useNavigate();
  const shouldKeepUnknown = unknownParams !== 'remove';
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // the owned keys' part of the search, which alone decides the value
  const ownedSearch = useMemo(() => {
    const owned = new URLSearchParams();
    for (const key of Object.keys(params)) {
      for (const text of searchParams.getAll(key)) {
        owned.append(key, text);
      }
    }
    return owned.toString();
  }, [params, searchParams]);

  /*
   * Parsed only when the owned keys change, so the value keeps its identity across renders that
   * pass new option objects, such as inline literals. The options are read as they are then.
   */
  const value = useMemo((): T => {
    try {
      return schema.parse(
        readSearchParamInput(new URLSearchParams(ownedSearch), params, defaultValue),
      );
    } catch {
      return defaultValue;
    }
  }, [ownedSearch]);

  const canonicalSearch = buildSearch(value, searchParams, params, defaultValue, shouldKeepUnknown);
  const currentSearch = location.search.replace(/^\?/, '');

  // the latest render's inputs, which the setter and the effects read, so the setter keeps its
  // identity
  const latest = useRef({ value, options, location, navigate });
  useLayoutEffect(() => {
    latest.current = { value, options, location, navigate };
  });

  const lastRepair = useRef<{ from: string; to: string } | null>(null);
  useEffect(() => {
    if (!shouldRepairSearch(currentSearch, canonicalSearch, lastRepair.current)) {
      return;
    }
    lastRepair.current = { from: currentSearch, to: canonicalSearch };
    const { location: current, navigate: go } = latest.current;
    void go(
      { pathname: current.pathname, search: canonicalSearch, hash: current.hash },
      { replace: true, state: current.state as unknown },
    );
  }, [currentSearch, canonicalSearch]);

  // the changes made in this tick, navigated to once at its end
  const pending = useRef<IPendingChange<T> | null>(null);

  const setValue = useCallback<ISetSearchParamState<T>>((next, { replace = false } = {}) => {
    const queued = pending.current;
    const { options: currentOptions, location: current } = latest.current;
    const base = queued === null ? latest.current.value : queued.value;
    const resolved = typeof next === 'function' ? next(base) : next;
    // serialized now, so a value the URL can't hold throws where it was set
    buildSearch(
      resolved,
      new URLSearchParams(current.search),
      currentOptions.params,
      currentOptions.defaultValue,
      currentOptions.unknownParams !== 'remove',
    );
    pending.current = {
      value: resolved,
      replace: queued === null ? replace : queued.replace && replace,
    };
    if (queued !== null) {
      return;
    }
    queueMicrotask(() => {
      const change = pending.current as IPendingChange<T>;
      pending.current = null;
      const { options: latestOptions, location: now, navigate: go } = latest.current;
      const search = buildSearch(
        change.value,
        new URLSearchParams(now.search),
        latestOptions.params,
        latestOptions.defaultValue,
        latestOptions.unknownParams !== 'remove',
      );
      if (search === now.search.replace(/^\?/, '')) {
        return;
      }
      void go(
        { pathname: now.pathname, search, hash: now.hash },
        { replace: change.replace, state: now.state as unknown },
      );
    });
  }, []);

  return [value, setValue];
};
