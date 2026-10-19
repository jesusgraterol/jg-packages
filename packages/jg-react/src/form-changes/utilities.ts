import { isEqual } from 'jg-utilities';

import type { IFormChangesComparable } from './types.js';

/**
 * Turns a command into the form commands are compared in, or keeps it as it is without a
 * normalizer.
 * @param command The command.
 * @param normalize The normalizer, such as one that trims text.
 * @returns The normalized command.
 */
export const normalizeFormCommand = <
  TCommand extends IFormChangesComparable,
  TNormalizedCommand extends IFormChangesComparable,
>(
  command: TCommand,
  normalize: ((command: TCommand) => TNormalizedCommand) | undefined,
): TNormalizedCommand =>
  normalize === undefined ? (command as unknown as TNormalizedCommand) : normalize(command);

/**
 * Compares two commands by value, as jg-utilities' isEqual does: through their deterministic JSON,
 * whatever their key order.
 * @param first One command.
 * @param second The other.
 * @returns Whether they're equal.
 * @throws
 * - UNABLE_TO_SERIALIZE_JSON: if either command holds a value JSON can't represent, such as a BigInt
 */
export const areFormCommandsEqual = (
  first: IFormChangesComparable,
  second: IFormChangesComparable,
): boolean => isEqual(first, second);

/**
 * Checks whether a newly confirmed command should replace the baseline: only when it differs by
 * value, so a parent that rebuilds the same command each render doesn't reset it.
 * @param previous The confirmed command last adopted.
 * @param next The confirmed command now.
 * @returns Whether to adopt it.
 */
export const shouldAdoptConfirmedCommand = (
  previous: IFormChangesComparable,
  next: IFormChangesComparable,
): boolean => !areFormCommandsEqual(previous, next);
