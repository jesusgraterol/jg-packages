import { constants } from 'node:os';
import { Exception, getErrorCode } from 'jg-exception';
import { ERRORS as PROCESS_ERRORS } from 'jg-process';

import { ERRORS, type ILockOwner, type ILockState } from '../locks/index.js';

import { USAGE_ERROR_CODE, WAIT_FOREVER } from './constants.js';
import type { ILockStatusRecord } from './types.js';

/**
 * Builds the CLI's error for arguments it can't use, which exits 2.
 * @param message What's wrong.
 * @returns The exception.
 */
export const usageError = (message: string): Exception =>
  new Exception(message, { code: USAGE_ERROR_CODE });

/**
 * Checks whether an error comes from the arguments: the CLI's own, jg-process's parser's, or a
 * lock name that isn't valid.
 * @param error The error.
 * @returns Whether it's a usage error.
 */
export const isUsageError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  return (
    code === USAGE_ERROR_CODE ||
    code === PROCESS_ERRORS.INVALID_ARGUMENTS ||
    code === ERRORS.LOCK_NAME_INVALID
  );
};

/**
 * Reads `--wait`: a number of seconds, 0 or more, or `forever`.
 * @param value The option's value, if it was given.
 * @returns The seconds, Infinity for forever, and 0 without the option.
 * @throws
 * - JG_LOCKS_USAGE: The --wait option takes a number of seconds or 'forever'.
 */
export const parseWait = (value: string | undefined): number => {
  if (value === undefined) {
    return 0;
  }
  if (value === WAIT_FOREVER) {
    return Infinity;
  }
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw usageError("The --wait option takes a number of seconds or 'forever'.");
  }
  return Number(value);
};

/**
 * Turns the signal that ended a process into the exit code a shell reports: 128 plus its number.
 * @param signal The signal.
 * @returns The exit code.
 */
export const toSignalExitCode = (signal: NodeJS.Signals): number =>
  128 + (constants.signals[signal] ?? 0);

/**
 * Reads for how long an owner has held its lock.
 * @param owner The owner.
 * @param nowMs The current time, in milliseconds since the epoch.
 * @returns The milliseconds, or null when the start time is unknown.
 */
const readHeldMs = (owner: ILockOwner, nowMs: number): number | null => {
  const startedAtMs = owner.startedAt === null ? Number.NaN : Date.parse(owner.startedAt);
  return Number.isNaN(startedAtMs) ? null : Math.max(0, nowMs - startedAtMs);
};

/**
 * Formats a duration in its two largest units, such as `3m 12s` or `2d 4h`.
 * @param ms The duration, in milliseconds.
 * @returns The duration.
 */
export const formatDuration = (ms: number): string => {
  const units: [string, number][] = [
    ['d', 86_400],
    ['h', 3600],
    ['m', 60],
    ['s', 1],
  ];
  let remaining = Math.floor(ms / 1000);
  const parts: string[] = [];
  for (const [unit, seconds] of units) {
    const count = Math.floor(remaining / seconds);
    remaining -= count * seconds;
    if (count > 0 || (unit === 's' && parts.length === 0)) {
      parts.push(`${count}${unit}`);
    }
  }
  return parts.slice(0, 2).join(' ');
};

/**
 * Describes who holds a lock, in one line, such as `node dev.js (pid 4242) on laptop in /srv/app,
 * for 3m 12s`.
 * @param state The lock's state.
 * @param nowMs The current time, in milliseconds since the epoch.
 * @returns The description.
 */
export const describeHolder = (state: ILockState, nowMs: number): string => {
  const { owner } = state;
  if (owner === null) {
    return 'no process: its owner.json is missing or invalid';
  }
  const heldMs = readHeldMs(owner, nowMs);
  return [
    `${owner.program ?? 'an unknown program'} (pid ${owner.pid}) on ${owner.hostname}`,
    owner.cwd === null ? '' : ` in ${owner.cwd}`,
    heldMs === null ? '' : `, for ${formatDuration(heldMs)}`,
  ].join('');
};

/**
 * Explains why a lock can't be taken, with the command that recovers it when its holder is gone.
 * @param state The lock's state.
 * @param nowMs The current time, in milliseconds since the epoch.
 * @returns The explanation.
 */
export const describeBusyLock = (state: ILockState, nowMs: number): string => {
  const lines = [`The lock '${state.name}' is ${state.state}: ${describeHolder(state, nowMs)}.`];
  if (state.state === 'owner-gone' && state.owner !== null) {
    lines.push(
      `Its holder is gone. Check what it left, then run: jg-locks recover ${state.name} --nonce ${state.owner.nonce}`,
    );
  }
  return lines.join('\n');
};

/**
 * Formats a lock for `jg-locks status`.
 * @param state The lock's state.
 * @param nowMs The current time, in milliseconds since the epoch.
 * @returns The lines.
 */
export const formatLockState = (state: ILockState, nowMs: number): string => {
  const lines = [`${state.name}: ${state.state}`];
  if (state.owner !== null) {
    const alive =
      state.isOwnerAlive === null ? 'unknown' : state.isOwnerAlive ? 'alive' : 'not running';
    lines.push(`  holder: ${describeHolder(state, nowMs)} (${alive})`);
    lines.push(`  nonce: ${state.owner.nonce}`);
  } else {
    lines.push(`  holder: ${describeHolder(state, nowMs)}`);
  }
  return lines.join('\n');
};

/**
 * Builds a lock's record for `jg-locks status --json`.
 * @param state The lock's state.
 * @param nowMs The current time, in milliseconds since the epoch.
 * @returns The record.
 */
export const toStatusRecord = (state: ILockState, nowMs: number): ILockStatusRecord => {
  const heldMs = state.owner === null ? null : readHeldMs(state.owner, nowMs);
  return {
    name: state.name,
    state: state.state,
    isOwnerAlive: state.isOwnerAlive,
    heldSeconds: heldMs === null ? null : Math.floor(heldMs / 1000),
    owner: state.owner,
  };
};

/**
 * Explains why `jg-locks recover` won't take a lock over.
 * @param state The lock's state.
 * @param nonce The nonce the caller named.
 * @returns The explanation, or null when the lock is that dead holder's.
 */
export const describeRecoveryRefusal = (state: ILockState, nonce: string): string | null => {
  if (state.state === 'free') {
    return `The lock '${state.name}' is free; there's nothing to recover.`;
  }
  if (state.owner !== null && state.owner.nonce !== nonce) {
    return `The lock '${state.name}' is held by nonce ${state.owner.nonce}, not ${nonce}. Run jg-locks status to see it.`;
  }
  if (state.state !== 'owner-gone') {
    return `The lock '${state.name}' is ${state.state}; jg-locks recover only takes a lock over from a holder whose process is gone.`;
  }
  return null;
};
