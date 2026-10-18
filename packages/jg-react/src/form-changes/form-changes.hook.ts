import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  IFormChangesComparable,
  IUseFormChangesOptions,
  IUseFormChangesResult,
} from './types.js';
import {
  areFormCommandsEqual,
  normalizeFormCommand,
  shouldAdoptConfirmedCommand,
} from './utilities.js';

/**
 * Tells whether a form holds unsaved changes, by comparing the command it edits with the last one
 * the server confirmed, so a save button can stay disabled until something changed. Commands are
 * compared by value, as JSON: a Map or a Set compares as `{}`, a key whose value is `undefined`
 * doesn't count, and a BigInt throws `UNABLE_TO_SERIALIZE_JSON`. Pass `normalizeCommand` to compare
 * commands the way the server stores them, such as with trimmed text.
 *
 * The baseline advances only when `confirmedCommand` changes by value, or through
 * `confirmChanges` once a save succeeds, so a failed save keeps the changes. `guardSubmission`
 * checks again as the form submits, in case the command changed since the last render.
 * @param options The confirmed command, the current one, and the optional normalizer.
 * @returns Whether the form holds changes, the submit-time check, and `confirmChanges`.
 * @example
 * import { useFormChanges } from 'jg-react';
 *
 * type IProfileCommand = { name: string; bio: string };
 *
 * const trimProfile = ({ name, bio }: IProfileCommand): IProfileCommand => ({
 *   name: name.trim(),
 *   bio: bio.trim(),
 * });
 *
 * export const useProfileForm = (saved: IProfileCommand, draft: IProfileCommand) => {
 *   const { hasChanges, guardSubmission, confirmChanges } = useFormChanges({
 *     confirmedCommand: saved,
 *     currentCommand: draft,
 *     normalizeCommand: trimProfile,
 *   });
 *   return { canSave: hasChanges, guardSubmission, confirmChanges };
 * };
 * @throws
 * - UNABLE_TO_SERIALIZE_JSON: if a command holds a value JSON can't represent, such as a BigInt
 */
export const useFormChanges = <
  TCommand extends IFormChangesComparable,
  TNormalizedCommand extends IFormChangesComparable = TCommand,
>({
  confirmedCommand,
  currentCommand,
  normalizeCommand,
}: IUseFormChangesOptions<TCommand, TNormalizedCommand>): IUseFormChangesResult<TCommand> => {
  const normalize = useCallback(
    (command: TCommand): TNormalizedCommand => normalizeFormCommand(command, normalizeCommand),
    [normalizeCommand],
  );
  const normalizedConfirmedCommand = useMemo(
    () => normalize(confirmedCommand),
    [confirmedCommand, normalize],
  );
  const adoptedConfirmedCommand = useRef(normalizedConfirmedCommand);
  const [baseline, setBaseline] = useState<TNormalizedCommand>(normalizedConfirmedCommand);

  useEffect(() => {
    if (!shouldAdoptConfirmedCommand(adoptedConfirmedCommand.current, normalizedConfirmedCommand)) {
      return;
    }
    adoptedConfirmedCommand.current = normalizedConfirmedCommand;
    setBaseline(normalizedConfirmedCommand);
  }, [normalizedConfirmedCommand]);

  const normalizedCurrentCommand = useMemo(
    () => normalize(currentCommand),
    [currentCommand, normalize],
  );
  const hasChanges = !areFormCommandsEqual(normalizedCurrentCommand, baseline);
  const guardSubmission = useCallback(
    (command: TCommand): boolean => !areFormCommandsEqual(normalize(command), baseline),
    [baseline, normalize],
  );
  const confirmChanges = useCallback(
    (command: TCommand): void => {
      setBaseline(normalize(command));
    },
    [normalize],
  );

  return useMemo(
    () => ({ confirmChanges, guardSubmission, hasChanges }),
    [confirmChanges, guardSubmission, hasChanges],
  );
};
