import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useSearchParamState } from '../search-param-state/index.js';

import type { ISearchParamDialog } from './types.js';
import { createDialogIdSchema, isDialogEntry, markDialogEntry } from './utilities.js';

/**
 * Keeps a page's open dialog in one search parameter, which holds the ID of what it shows, so a
 * link or a reload opens it. Opening adds a history entry, marked in its router state, so Back,
 * and the system back gesture on a phone, close it. Closing it otherwise goes back past that
 * entry, so it never lingers, whichever of the page's components opens or closes it. A dialog
 * the URL opened as the page loaded closes in place, replacing the entry. An empty ID, or one
 * longer than 4,096 characters, reads as closed.
 *
 * The dialog's own navigations must not close it: a dialog that closes when the route changes,
 * such as through useDialogNavigationDismissal, takes a session reader that returns null. A link
 * that moves the dialog to another ID keeps the router state, so Back still closes it.
 * @param name The search parameter, such as `event`.
 * @returns The open ID, empty while none is open, and what opens and closes the dialog.
 * @example
 * import { useSearchParamDialog } from 'jg-react-router';
 *
 * export const useEventDialog = () => useSearchParamDialog('event');
 */
export const useSearchParamDialog = (name: string): ISearchParamDialog => {
  const navigate = useNavigate();
  const location = useLocation();
  // the location as it is now, which `open` and `close` read without changing with it
  const latestLocationRef = useRef(location);
  useLayoutEffect(() => {
    latestLocationRef.current = location;
  }, [location]);
  const options = useMemo(
    () => ({
      params: { [name]: 'one' as const },
      schema: createDialogIdSchema(name),
      defaultValue: { [name]: '' },
    }),
    [name],
  );
  const [search, setSearch] = useSearchParamState<Record<string, string>>(options);

  const open = useCallback(
    (id: string) => {
      const { search: current, hash } = latestLocationRef.current;
      const state: unknown = latestLocationRef.current.state;
      const params = new URLSearchParams(current);
      params.set(name, id);
      void navigate(
        { search: `?${params.toString()}`, hash },
        { state: markDialogEntry(state, name) },
      );
    },
    [name, navigate],
  );

  const close = useCallback(() => {
    if (isDialogEntry(latestLocationRef.current.state, name)) {
      void navigate(-1);
      return;
    }
    setSearch({ [name]: '' }, { replace: true });
  }, [name, navigate, setSearch]);

  // the schema and the default always hold the parameter's key
  return { openId: search[name] as string, open, close };
};
