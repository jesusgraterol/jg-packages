import type { ISchema } from '../shared/index.js';

import { MAX_SEARCH_PARAM_DIALOG_ID_LENGTH, SEARCH_PARAM_DIALOG_STATE_KEY } from './constants.js';

/**
 * Builds the schema of a dialog's one search parameter, which reads an ID that's too long as
 * closed, so the URL is repaired without it.
 * @param name The search parameter.
 * @returns The schema.
 */
export const createDialogIdSchema = (name: string): ISchema<Record<string, string>> => ({
  parse: (input) => {
    const id = (input as Record<string, unknown>)[name];
    return {
      [name]: typeof id === 'string' && id.length <= MAX_SEARCH_PARAM_DIALOG_ID_LENGTH ? id : '',
    };
  },
});

/**
 * Adds the mark of a dialog's opening to a history entry's router state, keeping what it held.
 * @param state The router state.
 * @param name The dialog's search parameter.
 * @returns The marked state.
 */
export const markDialogEntry = (state: unknown, name: string): Record<string, unknown> => ({
  ...(typeof state === 'object' && state !== null ? state : {}),
  [SEARCH_PARAM_DIALOG_STATE_KEY]: name,
});

/**
 * Tells whether a history entry is the one a dialog's opening added.
 * @param state The entry's router state.
 * @param name The dialog's search parameter.
 * @returns Whether the dialog's opening added it.
 */
export const isDialogEntry = (state: unknown, name: string): boolean =>
  typeof state === 'object' &&
  state !== null &&
  (state as Record<string, unknown>)[SEARCH_PARAM_DIALOG_STATE_KEY] === name;
